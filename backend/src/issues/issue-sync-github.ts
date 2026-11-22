import { Injectable } from '@nestjs/common';
import { githubValues, type IssueValues } from './github-values.js';
import type { GoneReason } from './issue-link-store.js';
import type { SyncSubject } from './issue-sync-reader.js';
import { wholeSeconds } from './timestamps.js';
import { LoggerService } from '../core/logger.service.js';
import {
  IntegrationsGithubService,
  type GithubIssueRepo,
  type IssueFailure,
  type RenamedTo,
  type RepoFailure,
} from '../integrations/integrations-github.public.js';
import { RepositoriesService } from '../repositories/repositories.service.js';

/** What a candidate's attempt works on. */
export interface Target {
  subject: SyncSubject;
  repo: GithubIssueRepo;
  integrationId: number;
}

/** An attempt that did not end in a commit. */
export type FailedAttempt =
  /** A credential failure: the walk goes on with the next candidate. */
  | { kind: 'fallback'; reason: 'forbidden' | 'credential_invalid' }
  /** The E22 probe found the access lost: no fallback, `sync_failed`. */
  | { kind: 'access_lost'; reason: 'forbidden' | 'credential_invalid' }
  | { kind: 'gone'; reason: GoneReason }
  | { kind: 'rate_limited'; integrationId: number; resetAt: Date | null }
  | { kind: 'transient' };

/** What the `GET` of a candidate answered, ready to merge. */
export interface GithubRead {
  kind: 'read';
  /** GitHub's values (G); the base itself after a `304`. */
  remote: IssueValues;
  /** GitHub's `updated_at` (E7). */
  remoteUpdatedAt: Date;
  /** The `GET`'s `updated_at` as stored (the stored one after a `304`). */
  githubUpdatedAt: Date | null;
  /** The `ETag` of a `200` (the stored one after a `304`). */
  etag: string | null;
  /** The repository to address from now on: renamed, when GitHub said so. */
  repo: GithubIssueRepo;
}

const EPOCH = new Date(0);

/**
 * The read side of one candidate's attempt: the conditional `GET`, the handling of a rename
 * (E65), the E22 probe and the classification of every failure of a `GET` or `PATCH`. It makes
 * `GET` calls only: the one `PATCH` lives in the issues sync service. Logs carry the link id, the
 * integration id and the result kind only.
 */
@Injectable()
export class IssueSyncGithub {
  /**
   * @param {IntegrationsGithubService} github - The `GET`-only issue reads and the probe.
   * @param {RepositoriesService} repositories - Persists a rename.
   * @param {LoggerService} logger - Safe-field logs only.
   */
  constructor(
    private readonly github: IntegrationsGithubService,
    private readonly repositories: RepositoriesService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * The conditional `GET` of the link's issue, with the stored `ETag` (a `304` means GitHub equals
   * the base). A rename is handed to Repositories before anything else reads or writes.
   * @param {Target} target - The snapshot, the repository and the integration.
   * @returns {Promise<GithubRead | FailedAttempt>} The answer to merge, or why the attempt ended.
   */
  async read(target: Target): Promise<GithubRead | FailedAttempt> {
    const { subject, integrationId } = target;
    const got = await this.github.getIssue(subject.userId, integrationId, target.repo, subject.githubNumber, subject.etag);

    this.log(subject.linkId, integrationId, 'getIssue', got.kind);

    if (got.kind === 'not_modified') {
      return {
        kind: 'read',
        remote: subject.base,
        remoteUpdatedAt: subject.githubUpdatedAt ?? EPOCH,
        githubUpdatedAt: subject.githubUpdatedAt,
        etag: subject.etag,
        repo: target.repo,
      };
    }

    if (got.kind !== 'ok') return this.classify(got, target);

    return {
      kind: 'read',
      remote: githubValues(got.issue),
      remoteUpdatedAt: got.issue.updatedAt,
      githubUpdatedAt: wholeSeconds(got.issue.updatedAt),
      etag: got.etag,
      repo: await this.follow(target, got.renamedTo),
    };
  }

  /**
   * Hands a rename to Repositories (E65): the stored names are refreshed and no state changes.
   * @param {Target} target - The attempt's target.
   * @param {RenamedTo | undefined} renamedTo - The new names GitHub reported, if any.
   * @returns {Promise<GithubIssueRepo>} The repository to address from now on.
   */
  async follow(target: Target, renamedTo: RenamedTo | undefined): Promise<GithubIssueRepo> {
    if (renamedTo === undefined || target.subject.repositoryId === null) return target.repo;

    await this.repositories.applyRename(target.subject.userId, target.subject.repositoryId, renamedTo);

    return { ...target.repo, ...renamedTo };
  }

  /**
   * Classifies a failed `GET` or `PATCH` (`docs/agents/specs/issues/sync.md#retries-and-sync_failed`).
   * @param {IssueFailure | RepoFailure} result - The failure.
   * @param {Target} target - The attempt's target.
   * @returns {Promise<FailedAttempt>} What the walk does next.
   */
  async classify(result: IssueFailure | RepoFailure, target: Target): Promise<FailedAttempt> {
    switch (result.kind) {
      case 'not_found':
      case 'gone':
        return this.#probe(target);
      case 'moved':
        return { kind: 'gone', reason: 'moved' };
      case 'rate_limited':
        return { kind: 'rate_limited', integrationId: target.integrationId, resetAt: result.resetAt };
      case 'forbidden':
        return { kind: 'fallback', reason: 'forbidden' };
      case 'invalid_credentials':
      case 'integration_unusable':
        return { kind: 'fallback', reason: 'credential_invalid' };
      default:
        return { kind: 'transient' };
    }
  }

  /**
   * @param {number} linkId - The link.
   * @param {number} integrationId - The integration that answered.
   * @param {string} operation - The GitHub operation.
   * @param {string} result - The result kind (never its content).
   * @returns {void}
   */
  log(linkId: number, integrationId: number, operation: string, result: string): void {
    this.logger.debug('issues sync call', { context: 'IssuesSyncService', linkId, integrationId, operation, result });
  }

  /**
   * The E22 probe, with the integration that got the `404` or `410`: when the issues list still
   * answers, the issue is deleted; when it does not, access was lost.
   * @param {Target} target - The attempt's target.
   * @returns {Promise<FailedAttempt>} What the walk does next.
   */
  async #probe(target: Target): Promise<FailedAttempt> {
    const probe = await this.github.probeIssues(target.subject.userId, target.integrationId, target.repo);

    this.log(target.subject.linkId, target.integrationId, 'probeIssues', probe.kind);

    switch (probe.kind) {
      case 'ok':
        return { kind: 'gone', reason: 'deleted' };
      case 'not_found':
      case 'forbidden':
        return { kind: 'access_lost', reason: 'forbidden' };
      case 'invalid_credentials':
      case 'integration_unusable':
        return { kind: 'access_lost', reason: 'credential_invalid' };
      case 'rate_limited':
        return { kind: 'rate_limited', integrationId: target.integrationId, resetAt: probe.resetAt };
      default:
        return { kind: 'transient' };
    }
  }
}
