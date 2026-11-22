import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { IssueGithubLink } from './entities/issue-github-link.entity.js';
import type { Issue } from './entities/issue.entity.js';
import type { IssuesProject } from './entities/issues-project.entity.js';
import { IssueLinkPresenter } from './issue-link-presenter.js';
import { IssueLinkStore } from './issue-link-store.js';
import { IssueMarkers } from './issue-markers.js';
import { IssueReconcileQueue } from './issue-reconcile-queue.js';
import { issueResponse, type IssueResponse } from './issue-response.js';
import { IssuesAccess } from './issues-access.js';
import {
  issueLinkGone,
  issueNotLinked,
  projectHasNoRepository,
  projectRepositoryUnavailable,
} from './issues-http-errors.js';
import { stampOf } from './timestamps.js';
import type {
  RefreshIssueResponse,
  RefreshProjectResponse,
  RetrySyncResponse,
  TriggerResult,
} from './types/issues-api.types.js';
import { Clock } from '../core/clock.js';
import { RepositoriesService } from '../repositories/repositories.service.js';

/** A link synced less than this long ago, with no marker, is "already fresh" (60 s). */
export const FRESH_MS = 60_000;

/** The link of the issue a trigger targets, after the refusals. */
interface Target {
  issue: Issue;
  link: IssueGithubLink;
}

/**
 * Whether a manual refresh skips a link: it has no marker (a link with a marker has a write to
 * push, so it is never skipped) and was synced under 60 seconds ago.
 * @param {boolean} hasMarker - Whether the link has a pending marker.
 * @param {Date | null} lastSyncedAt - When the link was last synced.
 * @param {Date} now - The current instant.
 * @returns {boolean} `true` when the refresh is skipped.
 */
export function isFresh(hasMarker: boolean, lastSyncedAt: Date | null, now: Date): boolean {
  return !hasMarker && lastSyncedAt !== null && now.getTime() - lastSyncedAt.getTime() < FRESH_MS;
}

/**
 * The manual sync triggers T2, T3 and T4 (`docs/agents/specs/issues/api/github-link.md#trigger-routes`).
 * Each makes its refusals first, before any reset or enqueue, and never calls GitHub: it only
 * resets a failure and enqueues reconciles through the per-link dedupe. The `404`s come from
 * `IssuesAccess`; the owner's own project and issue only.
 */
@Injectable()
export class IssueSyncTriggersService {
  /**
   * @param {IssuesAccess} access - The single "this user's live project, or 404" check.
   * @param {IssueLinkStore} links - The link reads, the T3 listing and the T4 reset.
   * @param {IssueMarkers} markers - Whether a link has a marker.
   * @param {IssueLinkPresenter} presenter - Builds the `link` member of the response.
   * @param {RepositoriesService} repositories - The project's repository status.
   * @param {IssueReconcileQueue} queue - The deduplicating queue.
   * @param {Clock} clock - The time source (the fresh skip, the reset's `updated_at`).
   * @param {DataSource} dataSource - Opens the reads and the reset.
   */
  constructor(
    private readonly access: IssuesAccess,
    private readonly links: IssueLinkStore,
    private readonly markers: IssueMarkers,
    private readonly presenter: IssueLinkPresenter,
    private readonly repositories: RepositoriesService,
    private readonly queue: IssueReconcileQueue,
    private readonly clock: Clock,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * T2: refreshes one issue. A link with no marker synced under 60 seconds ago is skipped
   * (`200`, `alreadyFresh`); any other is enqueued (`202`), a `sync_failed` or rate-limited one included.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @param {string} issueUuid - The issue's public id.
   * @returns {Promise<TriggerResult<RefreshIssueResponse>>} The status and `{ issue, alreadyFresh }`.
   * @throws {NotFoundException} `NOT_FOUND` for a missing project, or an issue that is missing or in another project.
   * @throws {ConflictException} `ISSUE_NOT_LINKED`, `ISSUE_LINK_GONE` or `PROJECT_REPOSITORY_UNAVAILABLE`.
   */
  async refreshIssue(userId: number, projectUuid: string, issueUuid: string): Promise<TriggerResult<RefreshIssueResponse>> {
    const { issue, link } = await this.#target(userId, projectUuid, issueUuid);
    const marker = await this.dataSource.transaction((manager) => this.markers.findRevision(manager, link.id, { lock: false }));
    const alreadyFresh = isFresh(marker !== null, link.lastSyncedAt, this.clock.now());

    if (!alreadyFresh) this.queue.enqueue(link.id);

    return { status: alreadyFresh ? 200 : 202, body: { issue: await this.#respond(issue), alreadyFresh } };
  }

  /**
   * T3: refreshes a project: one reconcile per non-`gone` link, oldest `last_synced_at` first,
   * skipping the fresh links that have no marker. A project with no links answers zeros.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @returns {Promise<TriggerResult<RefreshProjectResponse>>} `202` and the two counts.
   * @throws {NotFoundException} `NOT_FOUND` when no live project of this user has that uuid.
   * @throws {ConflictException} `PROJECT_HAS_NO_REPOSITORY` or `PROJECT_REPOSITORY_UNAVAILABLE`.
   */
  async refreshProject(userId: number, projectUuid: string): Promise<TriggerResult<RefreshProjectResponse>> {
    const project = await this.access.findLiveProject(userId, projectUuid);

    if (project.repositoryId === null) throw projectHasNoRepository();

    await this.#assertRepository(userId, project);

    const rows = await this.links.listSyncableByProject(this.dataSource.manager, project.id);
    const now = this.clock.now();
    let skippedFresh = 0;

    for (const row of rows) {
      if (isFresh(row.hasMarker, row.lastSyncedAt, now)) skippedFresh += 1;
      else this.queue.enqueue(row.linkId);
    }

    return { status: 202, body: { enqueued: rows.length - skippedFresh, skippedFresh } };
  }

  /**
   * T4: retries the sync of a link. A `sync_failed` link is reset to `linked` with no reason at once
   * and enqueued (`202`); a `linked` link (a double click) is a no-op (`200`).
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @param {string} issueUuid - The issue's public id.
   * @returns {Promise<TriggerResult<RetrySyncResponse>>} The status and `{ issue }`.
   * @throws {NotFoundException} `NOT_FOUND` for a missing project, or an issue that is missing or in another project.
   * @throws {ConflictException} `ISSUE_NOT_LINKED`, `ISSUE_LINK_GONE` or `PROJECT_REPOSITORY_UNAVAILABLE`.
   */
  async retrySync(userId: number, projectUuid: string, issueUuid: string): Promise<TriggerResult<RetrySyncResponse>> {
    const { issue, link } = await this.#target(userId, projectUuid, issueUuid);

    if (link.status === 'sync_failed') {
      const reset = await this.dataSource.transaction((manager) => this.links.markLinked(manager, link.id, stampOf(this.clock)));

      // The link turned gone (or was unlinked) between the read and the reset: nothing to retry.
      if (!reset) throw issueLinkGone();

      this.queue.enqueue(link.id);
    }

    return { status: link.status === 'sync_failed' ? 202 : 200, body: { issue: await this.#respond(issue) } };
  }

  /**
   * The refusals of T2 and T4, in order: the project and the issue (`404`), the link
   * (`ISSUE_NOT_LINKED`), a `gone` link, and the repository.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @param {string} issueUuid - The issue's public id.
   * @returns {Promise<Target>} The issue and its link.
   */
  async #target(userId: number, projectUuid: string, issueUuid: string): Promise<Target> {
    const project = await this.access.findLiveProject(userId, projectUuid);
    const issue = await this.access.findIssueInProject(project, issueUuid);
    const link = await this.links.findByIssue(this.dataSource.manager, issue.id, { lock: false });

    if (link === null) throw issueNotLinked();
    if (link.status === 'gone') throw issueLinkGone();

    await this.#assertRepository(userId, project);

    return { issue, link };
  }

  /**
   * Refuses a dangling or Unavailable repository (Unknown is allowed).
   * @param {number} userId - The session's user.
   * @param {IssuesProject} project - The live project.
   * @returns {Promise<void>}
   */
  async #assertRepository(userId: number, project: IssuesProject): Promise<void> {
    if (project.repositoryId === null) throw projectRepositoryUnavailable();

    const summary = (await this.repositories.projectSummaries(userId, [project.repositoryId])).get(project.repositoryId);

    if (summary === undefined || summary.status === 'unavailable') throw projectRepositoryUnavailable();
  }

  /**
   * @param {Issue} issue - The stored issue.
   * @returns {Promise<IssueResponse>} The wire shape, with its link read once (after the reset or enqueue).
   */
  async #respond(issue: Issue): Promise<IssueResponse> {
    const links = await this.presenter.forIssues([issue.id]);

    return issueResponse(issue, links.get(issue.id));
  }
}
