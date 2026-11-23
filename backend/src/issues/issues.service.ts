import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { normalizeBody } from './dto/issue-fields.js';
import type { Issue } from './entities/issue.entity.js';
import { IssueBulkState } from './issue-bulk-state.js';
import { IssueEditRateLimiter } from './issue-edit-rate-limiter.js';
import { IssueLinkPresenter } from './issue-link-presenter.js';
import { IssueMarkers } from './issue-markers.js';
import {
  issueDeleteResponse,
  issueListingResponse,
  issueResponse,
  type IssueDeleteResponse,
  type IssueListingResponse,
  type IssueResponse,
} from './issue-response.js';
import { type IssueChanges, IssueStore } from './issue-store.js';
import { IssueSyncTrigger } from './issue-sync-trigger.js';
import { IssuesAccess } from './issues-access.js';
import { IssuesConfig } from './issues-config.js';
import { issueEditRateLimited, issueLinked, issuesLimitReached } from './issues-http-errors.js';
import { stampOf } from './timestamps.js';
import { Clock } from '../core/clock.js';
import { LoggerService } from '../core/logger.service.js';
import type {
  BulkIssueStateInput,
  BulkIssueStateResponse,
  CreateIssueInput,
  EditIssueInput,
  ListIssuesInput,
} from './types/issues-api.types.js';

/** What the edit transaction hands back: the stored issue and the link whose marker was bumped. */
interface EditOutcome {
  issue: Issue;
  linkId: number | null;
}

/**
 * The Issues business logic (`docs/agents/specs/issues/api/issues.md`): the one surface of the
 * issues controller, with typed inputs and the wire shapes as outputs. Every method starts from
 * `IssuesAccess` (the project first, then the issue inside it). It has no GitHub dependency and
 * enqueues nothing itself, only through the `IssueSyncTrigger` port.
 */
@Injectable()
export class IssuesService {
  /**
   * @param {IssuesAccess} access - The single "this user's live project, or 404" check.
   * @param {IssueStore} store - The `issues` reads and writes.
   * @param {IssueMarkers} markers - The marker upsert and the link check.
   * @param {IssueLinkPresenter} linkPresenter - Builds the `link` member of the responses.
   * @param {IssueEditRateLimiter} limiter - The per-user edit window.
   * @param {IssueSyncTrigger} syncTrigger - The after-commit hook of edits that bumped a marker.
   * @param {IssuesConfig} config - Supplies `maxIssuesPerProject`.
   * @param {DataSource} dataSource - Opens the transactions.
   * @param {Clock} clock - The time source of `created_at` and `updated_at`.
   * @param {LoggerService} logger - Safe-field logs only (link ids, never content).
   * @param {IssueBulkState} bulk - The bulk close/reopen flow.
   */
  constructor(
    private readonly access: IssuesAccess,
    private readonly store: IssueStore,
    private readonly markers: IssueMarkers,
    private readonly linkPresenter: IssueLinkPresenter,
    private readonly limiter: IssueEditRateLimiter,
    private readonly syncTrigger: IssueSyncTrigger,
    private readonly config: IssuesConfig,
    private readonly dataSource: DataSource,
    private readonly clock: Clock,
    private readonly logger: LoggerService,
    private readonly bulk: IssueBulkState,
  ) {}

  /**
   * One page of the project's issues, newest first, without bodies. Makes no write and enqueues
   * nothing; the link objects are loaded once for the whole page.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @param {ListIssuesInput} input - The validated page, page size, state filter and search.
   * @returns {Promise<IssueListingResponse>} `{ issues, pagination }`; a page past the end is empty.
   * @throws {NotFoundException} `NOT_FOUND` when no live project of this user has that uuid.
   */
  async list(userId: number, projectUuid: string, input: ListIssuesInput): Promise<IssueListingResponse> {
    const project = await this.access.findLiveProject(userId, projectUuid);
    const { issues, total } = await this.store.page(project.id, input);
    const links = await this.linkPresenter.forIssues(issues.map((issue) => issue.id));

    return issueListingResponse(issues, links, {
      page: input.page,
      perPage: input.perPage,
      total,
      totalPages: Math.ceil(total / input.perPage),
    });
  }

  /**
   * Creates an unlinked issue in one transaction under the project row lock, which serializes
   * creations so the cap cannot be overrun. Nothing is enqueued.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @param {CreateIssueInput} input - The validated input (`body` already normalized).
   * @returns {Promise<IssueResponse>} The new issue object.
   * @throws {NotFoundException} `NOT_FOUND` when no live project of this user has that uuid.
   * @throws {ConflictException} `ISSUES_LIMIT_REACHED` when the project is at the cap.
   */
  async create(userId: number, projectUuid: string, input: CreateIssueInput): Promise<IssueResponse> {
    const issue = await this.dataSource.transaction(async (manager) => {
      const project = await this.access.findLiveProject(userId, projectUuid, manager, { lock: true });

      if (await this.store.countInProject(manager, project.id) >= this.config.maxIssuesPerProject) {
        throw issuesLimitReached();
      }

      return this.store.insert(manager, {
        uuid: randomUUID(),
        projectId: project.id,
        title: input.title,
        body: input.body,
        state: input.state,
        createdAt: stampOf(this.clock),
        updatedAt: this.clock.now(),
      });
    });

    return this.#respond(issue);
  }

  /**
   * One issue of the project, with its body and link.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @param {string} issueUuid - The issue's public id.
   * @returns {Promise<IssueResponse>} The issue object.
   * @throws {NotFoundException} `NOT_FOUND` for a missing project, or an issue that is missing or in another project.
   */
  async show(userId: number, projectUuid: string, issueUuid: string): Promise<IssueResponse> {
    const project = await this.access.findLiveProject(userId, projectUuid);

    return this.#respond(await this.access.findIssueInProject(project, issueUuid));
  }

  /**
   * Edits title, body and/or state. The rate limit comes first, before any lookup, and a refused
   * call consumes nothing. The transaction takes no project lock: it locks the issue, then its
   * link, then the marker. An empty body, or values equal to the stored ones, writes nothing,
   * bumps no marker and leaves `updated_at` alone. When the edit bumped a marker, the sync
   * trigger runs after the commit and can never fail the request.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @param {string} issueUuid - The issue's public id.
   * @param {EditIssueInput} input - The validated input (`body` already normalized).
   * @returns {Promise<IssueResponse>} The issue object, as stored after the edit.
   * @throws {HttpException} `ISSUE_EDIT_RATE_LIMITED` (429) when the user's window is full.
   * @throws {NotFoundException} `NOT_FOUND` for a missing project, or an issue that is missing or in another project.
   */
  async edit(userId: number, projectUuid: string, issueUuid: string, input: EditIssueInput): Promise<IssueResponse> {
    const decision = this.limiter.consume(userId, 1);

    if (!decision.allowed) throw issueEditRateLimited(Math.ceil(decision.retryAfterMs / 1000));

    const { issue, linkId } = await this.dataSource.transaction((manager) => this.#editIn(manager, userId, projectUuid, issueUuid, input));

    if (linkId !== null) this.#afterCommit(linkId);

    return this.#respond(issue);
  }

  /**
   * Closes or reopens many issues of the project at once (`api/issues.md#bulk-close-and-reopen`),
   * delegating to `IssueBulkState`: per-issue outcomes, one transaction, and one T1 per changed
   * syncing link after the commit.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @param {BulkIssueStateInput} input - The validated, lowercased ids and the target state.
   * @returns {Promise<BulkIssueStateResponse>} `{ state, changed, unchanged, notFound }`.
   * @throws {HttpException} `ISSUE_EDIT_RATE_LIMITED` (429) when the user's window cannot take the weight.
   * @throws {NotFoundException} `NOT_FOUND` for a missing, foreign or deleted project.
   */
  bulkState(userId: number, projectUuid: string, input: BulkIssueStateInput): Promise<BulkIssueStateResponse> {
    return this.bulk.run(userId, projectUuid, input);
  }

  /**
   * Deletes an unlinked issue in one transaction (project row lock first, then the issue, then
   * the link check). Never touches GitHub; a repeat answers `404`.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @param {string} issueUuid - The issue's public id.
   * @returns {Promise<IssueDeleteResponse>} `{}`.
   * @throws {NotFoundException} `NOT_FOUND` for a missing project, or an issue that is missing or in another project.
   * @throws {ConflictException} `ISSUE_LINKED` when the issue still has a GitHub link.
   */
  async delete(userId: number, projectUuid: string, issueUuid: string): Promise<IssueDeleteResponse> {
    await this.dataSource.transaction(async (manager) => {
      const project = await this.access.findLiveProject(userId, projectUuid, manager, { lock: true });
      const issue = await this.access.findIssueInProject(project, issueUuid, manager, { lock: true });

      if (await this.markers.hasLink(manager, issue.id)) throw issueLinked();

      await this.store.delete(manager, issue.id);
    });

    return issueDeleteResponse();
  }

  /**
   * The edit transaction: no project lock, the issue row locked, then the write and the marker.
   * @param {EntityManager} manager - The transaction manager.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @param {string} issueUuid - The issue's public id.
   * @param {EditIssueInput} input - The validated input.
   * @returns {Promise<EditOutcome>} The stored issue and the bumped link id, if any.
   */
  async #editIn(
    manager: EntityManager,
    userId: number,
    projectUuid: string,
    issueUuid: string,
    input: EditIssueInput,
  ): Promise<EditOutcome> {
    const project = await this.access.findLiveProject(userId, projectUuid, manager);
    const issue = await this.access.findIssueInProject(project, issueUuid, manager, { lock: true });
    const changes = changesOf(issue, input);

    if (changes === null) return { issue, linkId: null };

    const updatedAt = this.clock.now();

    await this.store.update(manager, issue.id, changes, updatedAt);

    const linkId = await this.markers.upsertForEdit(manager, issue.id, stampOf(this.clock));

    return { issue: Object.assign(issue, changes, { updatedAt }), linkId };
  }

  /**
   * Runs the sync trigger for a bumped marker. A failure is logged with the link id only (never
   * content) and never fails the request: the marker is the durable record.
   * @param {number} linkId - The link whose marker was bumped.
   * @returns {void}
   */
  #afterCommit(linkId: number): void {
    try {
      this.syncTrigger.afterCommit([linkId]);
    } catch (error) {
      this.logger.error('issues sync trigger failed', {
        context: 'IssuesService',
        linkIds: [linkId],
        errorClass: error instanceof Error ? error.constructor.name : typeof error,
      });
    }
  }

  /**
   * The issue object with its link from the presenter (read once for the issue).
   * @param {Issue} issue - The stored issue.
   * @returns {Promise<IssueResponse>} The wire shape.
   */
  async #respond(issue: Issue): Promise<IssueResponse> {
    const links = await this.linkPresenter.forIssues([issue.id]);

    return issueResponse(issue, links.get(issue.id));
  }
}

/**
 * The fields of an edit that differ from the stored ones; an absent field is ignored.
 * @param {Issue} issue - The stored issue.
 * @param {EditIssueInput} input - The validated input.
 * @returns {IssueChanges | null} The changes, or `null` when there is nothing to write.
 */
function changesOf(issue: Issue, input: EditIssueInput): IssueChanges | null {
  const changes: IssueChanges = {};

  if (input.title !== undefined && input.title !== issue.title) changes.title = input.title;
  if (input.body !== undefined && normalizeBody(input.body) !== issue.body) changes.body = normalizeBody(input.body);
  if (input.state !== undefined && input.state !== issue.state) changes.state = input.state;

  return Object.keys(changes).length === 0 ? null : changes;
}
