import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { IssueEditRateLimiter } from './issue-edit-rate-limiter.js';
import { IssueMarkers } from './issue-markers.js';
import { bulkStateResponse } from './issue-response.js';
import { IssueStore } from './issue-store.js';
import { IssueSyncTrigger } from './issue-sync-trigger.js';
import { IssuesAccess } from './issues-access.js';
import { issueEditRateLimited } from './issues-http-errors.js';
import { wholeSeconds } from './timestamps.js';
import { Clock } from '../core/clock.js';
import { LoggerService } from '../core/logger.service.js';
import type { BulkIssueStateInput, BulkIssueStateResponse } from './types/issues-api.types.js';

/** What the bulk transaction hands back: the ids by outcome, and the links whose marker was bumped. */
interface BulkOutcome {
  changed: Set<string>;
  unchanged: Set<string>;
  linkIds: number[];
}

/**
 * The bulk close/reopen flow of `IssuesService#bulkState`
 * (`docs/agents/backend/routes/issues/issues.md#bulk-close-and-reopen`): the weighted rate limit, the
 * access check, then one transaction in the module's lock order (project, issues, links,
 * markers), and the sync trigger after the commit. Kept apart so the service stays small.
 */
@Injectable()
export class IssueBulkState {
  /**
   * @param {IssuesAccess} access - The single "this user's live project, or 404" check.
   * @param {IssueStore} store - The issue locks and the batch state write.
   * @param {IssueMarkers} markers - The links lock and the marker upsert.
   * @param {IssueEditRateLimiter} limiter - The per-user edit window, consumed by the id count.
   * @param {IssueSyncTrigger} syncTrigger - The after-commit hook for the bumped markers.
   * @param {DataSource} dataSource - Opens the transaction.
   * @param {Clock} clock - The time source of `updated_at` and the markers, read once per call.
   * @param {LoggerService} logger - Safe-field logs only (link ids, never content).
   */
  constructor(
    private readonly access: IssuesAccess,
    private readonly store: IssueStore,
    private readonly markers: IssueMarkers,
    private readonly limiter: IssueEditRateLimiter,
    private readonly syncTrigger: IssueSyncTrigger,
    private readonly dataSource: DataSource,
    private readonly clock: Clock,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Sets the state of many issues of the project. The rate limit is consumed first, with the id
   * count as its weight (a refusal consumes nothing and applies nothing), then the project is
   * resolved, then one transaction flips the issues that differ. Already-flipped and unknown ids
   * are reported, never failures. The trigger runs after the commit and never fails the request.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @param {BulkIssueStateInput} input - The validated, lowercased ids and the target state.
   * @returns {Promise<BulkIssueStateResponse>} `{ state, changed, unchanged, notFound }`, ids in request order.
   * @throws {HttpException} `ISSUE_EDIT_RATE_LIMITED` (429) when the user's window cannot take the weight.
   * @throws {NotFoundException} `NOT_FOUND` when no live project of this user has that uuid.
   */
  async run(userId: number, projectUuid: string, input: BulkIssueStateInput): Promise<BulkIssueStateResponse> {
    const decision = this.limiter.consume(userId, input.issueIds.length);

    if (!decision.allowed) throw issueEditRateLimited(Math.ceil(decision.retryAfterMs / 1000));

    await this.access.findLiveProject(userId, projectUuid);

    const outcome = await this.dataSource.transaction((manager) => this.#applyIn(manager, userId, projectUuid, input));

    if (outcome.linkIds.length > 0) this.#afterCommit(outcome.linkIds);

    return bulkStateResponse(input.state, input.issueIds, outcome);
  }

  /**
   * The transaction: project row lock, issue locks in id order, the batch write, then the markers.
   * @param {EntityManager} manager - The transaction manager.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @param {BulkIssueStateInput} input - The validated input.
   * @returns {Promise<BulkOutcome>} The ids by outcome and the bumped link ids.
   */
  async #applyIn(manager: EntityManager, userId: number, projectUuid: string, input: BulkIssueStateInput): Promise<BulkOutcome> {
    const project = await this.access.findLiveProject(userId, projectUuid, manager, { lock: true });
    const found = await this.store.lockManyInProject(manager, project.id, input.issueIds);
    const differing = found.filter((issue) => issue.state !== input.state);
    const outcome: BulkOutcome = {
      changed: new Set(differing.map((issue) => issue.uuid.toLowerCase())),
      unchanged: new Set(found.filter((issue) => issue.state === input.state).map((issue) => issue.uuid.toLowerCase())),
      linkIds: [],
    };

    if (differing.length === 0) return outcome;

    const now = this.clock.now();
    const changedIds = differing.map((issue) => issue.id);

    await this.store.updateStateMany(manager, changedIds, input.state, now);
    outcome.linkIds = await this.markers.upsertForBulk(manager, changedIds, wholeSeconds(now));

    return outcome;
  }

  /**
   * Runs the sync trigger once for every bumped marker. A failure is logged with the link ids
   * only (never content) and never fails the request: the markers are the durable record.
   * @param {number[]} linkIds - The links whose marker was bumped.
   * @returns {void}
   */
  #afterCommit(linkIds: number[]): void {
    try {
      this.syncTrigger.afterCommit(linkIds);
    } catch (error) {
      this.logger.error('issues sync trigger failed', {
        context: 'IssueBulkState',
        linkIds,
        errorClass: error instanceof Error ? error.constructor.name : typeof error,
      });
    }
  }
}
