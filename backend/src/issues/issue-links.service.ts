import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Issue } from './entities/issue.entity.js';
import type { IssuesProject } from './entities/issues-project.entity.js';
import { IssueGithubReader, type LinkReadOutcome } from './issue-github-reader.js';
import { IssueLinkPresenter } from './issue-link-presenter.js';
import { IssueLinkRateLimiter } from './issue-link-rate-limiter.js';
import { IssueLinkStore } from './issue-link-store.js';
import { IssueLinkWriter, type LinkTarget } from './issue-link-writer.js';
import { IssueMarkers } from './issue-markers.js';
import { issueResponse, type IssueResponse } from './issue-response.js';
import { IssueStore } from './issue-store.js';
import { IssuesAccess } from './issues-access.js';
import { IssuesConfig } from './issues-config.js';
import {
  githubCredentialUnusable,
  githubIssueIsPullRequest,
  githubIssueNotFound,
  issueAlreadyLinked,
  issueLinkRateLimited,
  issueNotLinked,
  issuesLimitReached,
  issueUnlinkHasUnsentChanges,
  projectHasNoRepository,
  projectRepositoryUnavailable,
} from './issues-http-errors.js';
import type { AttachIssueInput, ImportIssueInput, UnlinkIssueInput, UnlinkIssueResponse } from './types/issues-api.types.js';
import { githubRateLimited, githubUnavailable } from '../core/github-http-errors.js';
import type { GithubIssueRepo } from '../integrations/integrations-github.public.js';
import type { RepositorySummary } from '../repositories/repositories.public.js';
import { RepositoriesService } from '../repositories/repositories.service.js';

/** What the checks before the GitHub call settled. */
interface Prepared {
  repositoryId: number;
  repo: GithubIssueRepo;
}

/** The successful read of the GitHub issue. */
type ReadIssue = Extract<LinkReadOutcome, { kind: 'ok' }>;

/**
 * The GitHub link of an issue (`docs/agents/specs/issues/api/github-link.md`): import, attach and
 * unlink. Creating a link follows the documented order of checks: the rate limit, the access
 * checks, the cheap `409` pre-checks that make no GitHub call, then the single GitHub read
 * outside any transaction (no lock is held across the network call), then one transaction that
 * re-checks and writes (`IssueLinkWriter`). It never writes to GitHub, creates no marker and
 * enqueues nothing: a link creation read GitHub in the request and needs no sync. Unlink is local-only and works in every link
 * state. The `404`s all come from `IssuesAccess`.
 */
@Injectable()
export class IssueLinksService {
  /**
   * @param {IssuesAccess} access - The single "this user's live project, or 404" check.
   * @param {IssueLinkRateLimiter} limiter - The per-user link-creation window.
   * @param {IssueGithubReader} reader - The single GitHub read of a link creation.
   * @param {IssueLinkWriter} writer - The creation transaction.
   * @param {IssueLinkStore} links - The link queries.
   * @param {IssueMarkers} markers - The marker cleanup of unlink.
   * @param {IssueStore} issues - The cap count of the pre-check.
   * @param {IssueLinkPresenter} presenter - Builds the `link` member of the response.
   * @param {RepositoriesService} repositories - The project's repository summary.
   * @param {IssuesConfig} config - Supplies `maxIssuesPerProject`.
   * @param {DataSource} dataSource - Opens the unlink transaction.
   */
  constructor(
    private readonly access: IssuesAccess,
    private readonly limiter: IssueLinkRateLimiter,
    private readonly reader: IssueGithubReader,
    private readonly writer: IssueLinkWriter,
    private readonly links: IssueLinkStore,
    private readonly markers: IssueMarkers,
    private readonly issues: IssueStore,
    private readonly presenter: IssueLinkPresenter,
    private readonly repositories: RepositoriesService,
    private readonly config: IssuesConfig,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Imports a GitHub issue into the project as a new, linked issue.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @param {ImportIssueInput} input - The validated GitHub issue number.
   * @returns {Promise<IssueResponse>} The new issue object, with its link (`201`).
   * @throws {HttpException} The link failures of `api/github-link.md`, in its order of checks.
   */
  import(userId: number, projectUuid: string, input: ImportIssueInput): Promise<IssueResponse> {
    return this.#link(userId, projectUuid, input.number, { kind: 'import' });
  }

  /**
   * Attaches a GitHub issue to an existing, unlinked issue, replacing its values when they differ
   * and the caller confirmed.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @param {string} issueUuid - The issue's public id.
   * @param {AttachIssueInput} input - The validated number and optional confirmation.
   * @returns {Promise<IssueResponse>} The issue object, with its link (`200`).
   * @throws {HttpException} The link failures of `api/github-link.md`, in its order of checks.
   */
  attach(userId: number, projectUuid: string, issueUuid: string, input: AttachIssueInput): Promise<IssueResponse> {
    return this.#link(userId, projectUuid, input.number, {
      kind: 'attach',
      issueUuid,
      ...(input.confirmUpdatedAt === undefined ? {} : { confirmUpdatedAt: input.confirmUpdatedAt }),
    });
  }

  /**
   * Removes the link of an issue and its pending marker, in one transaction in lock order
   * (project, issue, link, marker). Makes no GitHub call and enqueues nothing; it works in every
   * link state and while the repository is Unavailable.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @param {string} issueUuid - The issue's public id.
   * @param {UnlinkIssueInput} input - Whether unsent changes may be dropped.
   * @returns {Promise<UnlinkIssueResponse>} The unlinked issue and whether unsent changes were dropped.
   * @throws {NotFoundException} `NOT_FOUND` for a missing project, or an issue that is missing or in another project.
   * @throws {ConflictException} `ISSUE_NOT_LINKED`, or `ISSUE_UNLINK_HAS_UNSENT_CHANGES` without the discard flag.
   */
  async unlink(userId: number, projectUuid: string, issueUuid: string, input: UnlinkIssueInput): Promise<UnlinkIssueResponse> {
    const { issue, droppedUnsentChanges } = await this.dataSource.transaction(async (manager) => {
      const project = await this.access.findLiveProject(userId, projectUuid, manager, { lock: true });
      const locked = await this.access.findIssueInProject(project, issueUuid, manager, { lock: true });
      const link = await this.links.findByIssue(manager, locked.id, { lock: true });

      if (link === null) throw issueNotLinked();

      // A refusal throws, which rolls the marker delete back: nothing changes (E63).
      const hadMarker = await this.markers.lockAndDeleteForLink(manager, link.id);

      if (hadMarker && !input.discardUnsentChanges) throw issueUnlinkHasUnsentChanges();

      await this.links.delete(manager, link.id);

      return { issue: locked, droppedUnsentChanges: hadMarker };
    });

    return { issue: issueResponse(issue, undefined), droppedUnsentChanges };
  }

  /**
   * The one link-creation path of import and attach, in the order of checks.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @param {number} number - The GitHub issue number.
   * @param {LinkTarget} target - Import, or attach to an issue.
   * @returns {Promise<IssueResponse>} The issue object, with its link.
   */
  async #link(userId: number, projectUuid: string, number: number, target: LinkTarget): Promise<IssueResponse> {
    const decision = this.limiter.consume(userId);

    if (!decision.allowed) throw issueLinkRateLimited(Math.ceil(decision.retryAfterMs / 1000));

    const prepared = await this.#prepare(userId, projectUuid, target);
    const github = await this.#read(userId, prepared, number);
    const issue = await this.writer.create(
      { userId, projectUuid, repositoryId: prepared.repositoryId, github: { issue: github.issue, etag: github.etag } },
      target,
    );

    return this.#respond(issue);
  }

  /**
   * The checks that make no GitHub call, in order: the project and (attach) its issue, the cap
   * (import) or an existing link (attach), and the repository.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @param {LinkTarget} target - Import or attach.
   * @returns {Promise<Prepared>} The repository to read.
   */
  async #prepare(userId: number, projectUuid: string, target: LinkTarget): Promise<Prepared> {
    const project = await this.access.findLiveProject(userId, projectUuid);

    await (target.kind === 'import' ? this.#assertRoom(project) : this.#assertAttachable(project, target.issueUuid));

    if (project.repositoryId === null) throw projectHasNoRepository();

    const summary = (await this.repositories.projectSummaries(userId, [project.repositoryId])).get(project.repositoryId);

    return { repositoryId: project.repositoryId, repo: repoOf(summary) };
  }

  /**
   * Import's pre-check: the project is below the cap (re-checked under the lock later).
   * @param {IssuesProject} project - The live project.
   * @returns {Promise<void>}
   */
  async #assertRoom(project: IssuesProject): Promise<void> {
    if (await this.issues.countInProject(this.dataSource.manager, project.id) >= this.config.maxIssuesPerProject) {
      throw issuesLimitReached();
    }
  }

  /**
   * Attach's pre-check: the issue is in the project and has no link yet.
   * @param {IssuesProject} project - The live project.
   * @param {string} issueUuid - The issue's public id.
   * @returns {Promise<void>}
   */
  async #assertAttachable(project: IssuesProject, issueUuid: string): Promise<void> {
    const issue = await this.access.findIssueInProject(project, issueUuid);

    if (await this.links.findByIssue(this.dataSource.manager, issue.id, { lock: false }) !== null) throw issueAlreadyLinked();
  }

  /**
   * The single GitHub read, mapped to the documented failures; a pull request is refused.
   * @param {number} userId - The session's user.
   * @param {Prepared} prepared - The repository to read.
   * @param {number} number - The GitHub issue number.
   * @returns {Promise<ReadIssue>} The GitHub issue and its ETag.
   */
  async #read(userId: number, prepared: Prepared, number: number): Promise<ReadIssue> {
    const outcome = await this.reader.readForLink(userId, prepared.repositoryId, prepared.repo, number);

    switch (outcome.kind) {
      case 'not_found':
        throw githubIssueNotFound();
      case 'rate_limited':
        throw githubRateLimited(outcome.retryAfterSeconds ?? undefined);
      case 'credential':
        throw githubCredentialUnusable(outcome.reason);
      case 'unavailable':
        throw githubUnavailable();
      default:
        if (outcome.issue.isPullRequest) throw githubIssueIsPullRequest();

        return outcome;
    }
  }

  /**
   * The issue object, with its link read once.
   * @param {Issue} issue - The stored issue.
   * @returns {Promise<IssueResponse>} The wire shape.
   */
  async #respond(issue: Issue): Promise<IssueResponse> {
    const links = await this.presenter.forIssues([issue.id]);

    return issueResponse(issue, links.get(issue.id));
  }
}

/**
 * The repository a read targets, refusing a dangling or Unavailable one (`unknown` is allowed).
 * @param {RepositorySummary | undefined} summary - The project's repository summary, if it resolves.
 * @returns {GithubIssueRepo} The repository's GitHub id and names.
 */
function repoOf(summary: RepositorySummary | undefined): GithubIssueRepo {
  if (summary === undefined || summary.status === 'unavailable') throw projectRepositoryUnavailable();

  return { githubId: summary.githubId, owner: summary.owner, name: summary.name };
}
