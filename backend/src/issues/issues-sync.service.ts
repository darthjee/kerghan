import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { IssueValues } from './github-values.js';
import { IssueCandidates } from './issue-candidates.js';
import { IssueLinkStore, type SyncFailureReason } from './issue-link-store.js';
import { IssueRateLimitPauses } from './issue-rate-limit-pauses.js';
import { type CommitPlan, IssueSyncCommit } from './issue-sync-commit.js';
import { type FailedAttempt, IssueSyncGithub, type Target } from './issue-sync-github.js';
import { mergeFields } from './issue-sync-merge.js';
import { IssueSyncReader, type SyncSubject } from './issue-sync-reader.js';
import { stampOf, wholeSeconds } from './timestamps.js';
import { AccountHandleService } from '../auth/account-handle.service.js';
import { Clock } from '../core/clock.js';
import {
  IntegrationsGithubIssueWriter,
  type GithubIssueChanges,
  type GithubIssueRepo,
} from '../integrations/integrations-github.public.js';
import { RepositoriesService } from '../repositories/repositories.service.js';

/** Why a reconcile stopped without retrying; the job never logs it, specs read it. */
export type StopReason =
  | 'no_link'
  | 'not_approved'
  | 'repository_unavailable'
  | 'credential'
  | 'gone'
  | 'retries_exhausted';

/** What one reconcile came to (`docs/agents/modules/issues/sync.md#job`): the job maps it. */
export type ReconcileOutcome =
  | { kind: 'done' }
  | { kind: 'requeue' }
  | { kind: 'stopped'; reason: StopReason }
  | { kind: 'transient' }
  | { kind: 'rate_limited'; until: Date };

/** One candidate integration's attempt: it ends in a commit, or in a failure. */
type Attempt = { kind: 'synced'; plan: CommitPlan } | FailedAttempt;

/** What the guards hand to the walk. */
interface Ready {
  repo: GithubIssueRepo;
  /** The candidates that are not paused, in order. */
  free: number[];
  /** The candidates paused by a rate limit. */
  paused: number[];
}

/**
 * The two-way sync of one link (`docs/agents/modules/issues/sync.md`): the guards, the candidate
 * walk with its credential fallback, the read of GitHub first, the per-field merge, the push and
 * the commit. It is the only injector of `IntegrationsGithubIssueWriter` (a static spec enforces
 * it). It never receives or returns a credential: GitHub is reached through integration ids.
 * Logs carry the link id, the integration id and a result kind only.
 */
@Injectable()
export class IssuesSyncService {
  /**
   * @param {IssueSyncReader} reader - Guard 1 and the marker, local and base snapshot.
   * @param {IssueSyncCommit} commit - The reconcile's commit transaction.
   * @param {IssueCandidates} candidates - The integrations that may serve the repository.
   * @param {IssueRateLimitPauses} pauses - The in-memory rate-limit pauses and waiting sets.
   * @param {AccountHandleService} accounts - Auth's approval check (guard 2).
   * @param {RepositoriesService} repositories - The repository's status and names.
   * @param {IssueSyncGithub} gh - The `GET`, rename, probe and failure classification.
   * @param {IntegrationsGithubIssueWriter} writer - The one `PATCH`.
   * @param {IssueLinkStore} links - The link status writes.
   * @param {DataSource} dataSource - Opens the status transactions.
   * @param {Clock} clock - The time source.
   */
  constructor(
    private readonly reader: IssueSyncReader,
    private readonly commit: IssueSyncCommit,
    private readonly candidates: IssueCandidates,
    private readonly pauses: IssueRateLimitPauses,
    private readonly accounts: AccountHandleService,
    private readonly repositories: RepositoriesService,
    private readonly gh: IssueSyncGithub,
    private readonly writer: IntegrationsGithubIssueWriter,
    private readonly links: IssueLinkStore,
    private readonly dataSource: DataSource,
    private readonly clock: Clock,
  ) {}

  /**
   * Reconciles one link: reads GitHub, merges per field, pushes the diff and commits.
   * @param {number} linkId - The link's internal id.
   * @param {{ lastAttempt: boolean }} options - `lastAttempt`: the job's last try, so a transient
   *   failure sets `sync_failed` with `retries_exhausted` instead of being retried.
   * @returns {Promise<ReconcileOutcome>} What happened; every state change was already written.
   */
  async reconcile(linkId: number, options: { lastAttempt: boolean }): Promise<ReconcileOutcome> {
    const subject = await this.reader.load(linkId);

    if (subject === null) return stopped('no_link');

    const gate = await this.#guard(subject);

    if (!('repo' in gate)) return gate;

    this.pauses.release(linkId);

    const outcome = await this.#walk(subject, gate);

    return outcome.kind === 'transient' && options.lastAttempt ? this.#fail(linkId, 'retries_exhausted') : outcome;
  }

  /**
   * Guards 2 to 5: the owner is approved, the repository is not Unavailable, a candidate resolves
   * and not every candidate is paused. No GitHub call is made before all pass.
   * @param {SyncSubject} subject - The snapshot.
   * @returns {Promise<Ready | ReconcileOutcome>} What the walk needs, or the final outcome.
   */
  async #guard(subject: SyncSubject): Promise<Ready | ReconcileOutcome> {
    if (!await this.accounts.isApproved(subject.userId)) return stopped('not_approved');

    const repo = await this.#repository(subject);

    if (repo === null || subject.repositoryId === null) return stopped('repository_unavailable');

    const resolution = await this.candidates.resolve(subject.userId, subject.repositoryId);

    if (resolution.kind === 'none') return this.#fail(subject.linkId, resolution.reason);

    const paused = resolution.ids.filter((id) => this.pauses.isPaused(id));
    const free = resolution.ids.filter((id) => !paused.includes(id));

    return free.length === 0 ? this.#waitOn(subject.linkId, paused) : { repo, free, paused };
  }

  /**
   * @param {SyncSubject} subject - The snapshot.
   * @returns {Promise<GithubIssueRepo | null>} The repository's id and names, or `null` when it is
   *   dangling or Unavailable (Unknown is allowed).
   */
  async #repository(subject: SyncSubject): Promise<GithubIssueRepo | null> {
    if (subject.repositoryId === null) return null;

    const summary = (await this.repositories.projectSummaries(subject.userId, [subject.repositoryId])).get(subject.repositoryId);

    return summary === undefined || summary.status === 'unavailable'
      ? null
      : { githubId: summary.githubId, owner: summary.owner, name: summary.name };
  }

  /**
   * Tries the candidates in order, restarting from the `GET` with the next one only on a
   * credential failure.
   * @param {SyncSubject} subject - The snapshot.
   * @param {Ready} ready - The repository and the candidates.
   * @returns {Promise<ReconcileOutcome>} The outcome.
   */
  async #walk(subject: SyncSubject, ready: Ready): Promise<ReconcileOutcome> {
    let sawForbidden = false;

    for (const integrationId of ready.free) {
      const attempt = await this.#attempt({ subject, repo: ready.repo, integrationId });

      if (attempt.kind !== 'fallback') return this.#settle(subject, attempt);

      sawForbidden ||= attempt.reason === 'forbidden';
    }

    // A paused candidate may still serve the link, so a failed walk is not a credential failure yet.
    if (ready.paused.length > 0) return this.#waitOn(subject.linkId, ready.paused);

    return this.#fail(subject.linkId, sawForbidden ? 'forbidden' : 'credential_invalid');
  }

  /**
   * Turns a final attempt into an outcome, writing the state it implies.
   * @param {SyncSubject} subject - The snapshot.
   * @param {Exclude<Attempt, { kind: 'fallback' }>} attempt - The attempt.
   * @returns {Promise<ReconcileOutcome>} The outcome.
   */
  async #settle(subject: SyncSubject, attempt: Exclude<Attempt, { kind: 'fallback' }>): Promise<ReconcileOutcome> {
    switch (attempt.kind) {
      case 'synced':
        return { kind: await this.commit.apply(subject, attempt.plan) };
      case 'gone':
        await this.dataSource.transaction((manager) => this.links.markGone(manager, subject.linkId, attempt.reason, stampOf(this.clock)));
        return stopped('gone');
      case 'access_lost':
        return this.#fail(subject.linkId, attempt.reason);
      case 'rate_limited': {
        this.pauses.pause(attempt.integrationId, attempt.resetAt);

        return this.#waitOn(subject.linkId, [attempt.integrationId]);
      }
      default:
        return { kind: 'transient' };
    }
  }

  /**
   * One candidate: the conditional `GET` (a `304` means GitHub equals the base), the per-field
   * merge, and the `PATCH` when the diff is not empty.
   * @param {Target} target - The snapshot, the repository and the integration.
   * @returns {Promise<Attempt>} The attempt's result.
   */
  async #attempt(target: Target): Promise<Attempt> {
    const { subject, integrationId } = target;
    const read = await this.gh.read(target);

    if (read.kind !== 'read') return read;

    const merge = mergeFields({
      local: subject.local,
      base: subject.base,
      remote: read.remote,
      localEditedAt: subject.marker?.updatedAt ?? subject.localUpdatedAt,
      remoteUpdatedAt: read.remoteUpdatedAt,
    });
    const plan: CommitPlan = {
      baseValues: { ...merge.push, ...merge.adopt },
      pulled: merge.pull,
      pushed: false,
      githubUpdatedAt: read.githubUpdatedAt,
      etag: read.etag,
    };

    if (Object.keys(merge.push).length === 0) return { kind: 'synced', plan };

    const put = await this.writer.updateIssue(subject.userId, integrationId, read.repo, subject.githubNumber, changesOf(merge.push));
    const pushTarget = { ...target, repo: read.repo };

    this.gh.log(subject.linkId, integrationId, 'updateIssue', put.kind);

    if (put.kind !== 'ok') return this.gh.classify(put, pushTarget);

    await this.gh.follow(pushTarget, put.renamedTo);

    return { kind: 'synced', plan: { ...plan, pushed: true, githubUpdatedAt: wholeSeconds(put.issue.updatedAt) } };
  }

  /**
   * The link joins the waiting set of the paused integration whose reset comes first; no call is made.
   * @param {number} linkId - The link.
   * @param {number[]} integrationIds - The paused candidates.
   * @returns {ReconcileOutcome} `rate_limited` until that reset.
   */
  #waitOn(linkId: number, integrationIds: number[]): ReconcileOutcome {
    const earliest = this.pauses.earliestPause(integrationIds);

    if (earliest === null) return { kind: 'rate_limited', until: this.clock.now() };

    return { kind: 'rate_limited', until: this.pauses.wait(earliest.integrationId, linkId) ?? earliest.resetAt };
  }

  /**
   * Sets the link `sync_failed` with a reason.
   * @param {number} linkId - The link.
   * @param {SyncFailureReason} reason - Why.
   * @returns {Promise<ReconcileOutcome>} `stopped`.
   */
  async #fail(linkId: number, reason: SyncFailureReason): Promise<ReconcileOutcome> {
    await this.dataSource.transaction((manager) => this.links.markSyncFailed(manager, linkId, reason, stampOf(this.clock)));

    return stopped(reason === 'retries_exhausted' ? 'retries_exhausted' : 'credential');
  }
}

/**
 * @param {StopReason} reason - Why the reconcile stopped.
 * @returns {ReconcileOutcome} The `stopped` outcome.
 */
function stopped(reason: StopReason): ReconcileOutcome {
  return { kind: 'stopped', reason };
}

/**
 * @param {Partial<IssueValues>} push - The fields to push.
 * @returns {GithubIssueChanges} The same fields, as the writer accepts them (never `state_reason`).
 */
function changesOf(push: Partial<IssueValues>): GithubIssueChanges {
  return { ...push };
}
