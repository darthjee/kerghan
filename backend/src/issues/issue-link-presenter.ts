import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { IssueRateLimitWaits } from './issue-rate-limit-waits.js';
import { IssuesConfig } from './issues-config.js';
import { Clock } from '../core/clock.js';
import type { RepositorySummary } from '../repositories/repositories.public.js';
import { RepositoriesService } from '../repositories/repositories.service.js';

/** The states a link can read as, in precedence order (`docs/agents/specs/issues/github-link.md#link-states`). */
export type IssueLinkState = 'gone' | 'sync_failed' | 'repository_unavailable' | 'rate_limited' | 'pending' | 'linked';

/** The link object of an issue (`docs/agents/specs/issues/api/github-link.md#link-object`). */
export interface IssueLinkResponse {
  number: number;
  /** Built from the repository's stored `owner`/`name`; `null` when the repository reference dangles. */
  url: string | null;
  state: IssueLinkState;
  states: IssueLinkState[];
  reason: string | null;
  rateLimitedUntil: string | null;
  lastSyncedAt: string;
  stale: boolean;
}

/** What the derived states are computed from. */
export interface LinkStateInput {
  /** The stored link status (`linked`, `sync_failed` or `gone`). */
  status: string;
  /** The repository summary's status, or `null` when the repository reference dangles. */
  repositoryStatus: string | null;
  rateLimited: boolean;
  pending: boolean;
}

/** One link row, read with its project. */
interface LinkRow {
  id: number;
  issueId: number;
  number: number;
  status: string;
  reason: string | null;
  lastSyncedAt: Date;
  userId: number;
  repositoryId: number | null;
}

/** The raw columns of the link query. */
interface RawLinkRow {
  id: number;
  issue_id: number;
  github_number: number;
  status: string;
  status_reason: string | null;
  last_synced_at: Date | null;
  created_at: Date;
  user_id: number;
  repository_id: number | null;
}

const LINK_ROWS_SQL = 'SELECT l.id, l.issue_id, l.github_number, l.status, l.status_reason, l.last_synced_at, l.created_at, '
  + 'p.user_id, p.repository_id FROM issues_github_links l JOIN issues i ON i.id = l.issue_id '
  + 'JOIN issues_projects p ON p.id = i.project_id WHERE l.issue_id IN (?)';

/**
 * Every state that applies, in precedence order: `gone`, `sync_failed`, `repository_unavailable`
 * (the repository row reads Unavailable, or it dangles), `rate_limited`, `pending`. `linked`
 * appears, alone, only when none of them applies.
 * @param {LinkStateInput} input - The link and what it depends on.
 * @returns {IssueLinkState[]} The states; the first is the primary one.
 */
export function statesOf(input: LinkStateInput): IssueLinkState[] {
  const states: IssueLinkState[] = [];

  if (input.status === 'gone') states.push('gone');
  if (input.status === 'sync_failed') states.push('sync_failed');
  if (input.repositoryStatus === null || input.repositoryStatus === 'unavailable') states.push('repository_unavailable');
  if (input.rateLimited) states.push('rate_limited');
  if (input.pending) states.push('pending');

  return states.length === 0 ? ['linked'] : states;
}

/** What `linkResponse` builds the object from. */
export interface LinkResponseInput {
  number: number;
  status: string;
  reason: string | null;
  lastSyncedAt: Date;
  summary: Pick<RepositorySummary, 'owner' | 'name' | 'status'> | undefined;
  rateLimitedUntil: Date | undefined;
  pending: boolean;
  now: Date;
  staleAfterSeconds: number;
}

/**
 * The link object. Every field is copied explicitly (never spread), so no internal id can leak.
 * @param {LinkResponseInput} input - The link row, the repository summary, the wait, the marker and the clock.
 * @returns {IssueLinkResponse} The wire shape.
 */
export function linkResponse(input: LinkResponseInput): IssueLinkResponse {
  const states = statesOf({
    status: input.status,
    repositoryStatus: input.summary?.status ?? null,
    rateLimited: input.rateLimitedUntil !== undefined,
    pending: input.pending,
  });
  const stale = input.status !== 'gone' && input.now.getTime() - input.lastSyncedAt.getTime() > input.staleAfterSeconds * 1000;

  return {
    number: input.number,
    url: input.summary === undefined ? null : `https://github.com/${input.summary.owner}/${input.summary.name}/issues/${input.number}`,
    state: states[0],
    states,
    reason: input.reason,
    rateLimitedUntil: input.rateLimitedUntil === undefined ? null : input.rateLimitedUntil.toISOString(),
    lastSyncedAt: input.lastSyncedAt.toISOString(),
    stale,
  };
}

/**
 * Builds the `link` member of the issue responses, once per page (the listing) or once per issue
 * (show, create, edit, import, attach and unlink). A call costs a constant number of reads, whatever the page
 * size: the links with their project, the markers, the repository summaries and the waiting sets
 * (from memory). The derived states are computed on read and never stored, and a read never
 * enqueues a job. Only issue ids that `IssuesAccess` already resolved are ever passed in.
 */
@Injectable()
export class IssueLinkPresenter {
  /**
   * @param {DataSource} dataSource - The default connection, for reads outside a transaction.
   * @param {RepositoriesService} repositories - The repository summaries.
   * @param {IssueRateLimitWaits} waits - Which links wait on a rate limit.
   * @param {IssuesConfig} config - Supplies `syncStaleAfterSeconds`.
   * @param {Clock} clock - The time source.
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly repositories: RepositoriesService,
    private readonly waits: IssueRateLimitWaits,
    private readonly config: IssuesConfig,
    private readonly clock: Clock,
  ) {}

  /**
   * @param {number[]} issueIds - The internal ids of the issues being presented.
   * @param {EntityManager} [manager] - The transaction manager to read through.
   * @returns {Promise<Map<number, IssueLinkResponse>>} The link objects by issue id; an issue
   *   without an entry has no link.
   */
  async forIssues(issueIds: number[], manager?: EntityManager): Promise<Map<number, IssueLinkResponse>> {
    if (issueIds.length === 0) return new Map();

    const runner = manager ?? this.dataSource.manager;
    const links = await this.#links(runner, issueIds);

    if (links.length === 0) return new Map();

    const linkIds = links.map((link) => link.id);
    const [pending, summaries] = await Promise.all([this.#markedLinkIds(runner, linkIds), this.#summaries(links)]);
    const waiting = this.waits.untilFor(linkIds);
    const now = this.clock.now();

    return new Map(links.map((link) => [link.issueId, linkResponse({
      number: link.number,
      status: link.status,
      reason: link.reason,
      lastSyncedAt: link.lastSyncedAt,
      summary: link.repositoryId === null ? undefined : summaries.get(link.userId)?.get(link.repositoryId),
      rateLimitedUntil: waiting.get(link.id),
      pending: pending.has(link.id),
      now,
      staleAfterSeconds: this.config.syncStaleAfterSeconds,
    })]));
  }

  /**
   * @param {EntityManager} runner - The manager to read through.
   * @param {number[]} issueIds - The issues.
   * @returns {Promise<LinkRow[]>} Their links, with the project's owner and repository.
   */
  async #links(runner: EntityManager, issueIds: number[]): Promise<LinkRow[]> {
    const rows: RawLinkRow[] = await runner.query(LINK_ROWS_SQL, [issueIds]);

    return rows.map((row) => ({
      id: row.id,
      issueId: row.issue_id,
      number: row.github_number,
      status: row.status,
      reason: row.status_reason,
      lastSyncedAt: new Date(row.last_synced_at ?? row.created_at),
      userId: row.user_id,
      repositoryId: row.repository_id,
    }));
  }

  /**
   * @param {EntityManager} runner - The manager to read through.
   * @param {number[]} linkIds - The links.
   * @returns {Promise<Set<number>>} The ids of the links that have a pending marker.
   */
  async #markedLinkIds(runner: EntityManager, linkIds: number[]): Promise<Set<number>> {
    const rows: Array<{ link_id: number }> = await runner.query(
      'SELECT link_id FROM issues_pending_writes WHERE link_id IN (?)',
      [linkIds],
    );

    return new Set(rows.map((row) => row.link_id));
  }

  /**
   * The repository summaries, one `projectSummaries` call per owner (a page has one project, so one).
   * @param {LinkRow[]} links - The links.
   * @returns {Promise<Map<number, Map<number, RepositorySummary>>>} The summaries by owner, then by repository id.
   */
  async #summaries(links: LinkRow[]): Promise<Map<number, Map<number, RepositorySummary>>> {
    const idsByUser = new Map<number, number[]>();

    for (const link of links) {
      if (link.repositoryId !== null) idsByUser.set(link.userId, [...(idsByUser.get(link.userId) ?? []), link.repositoryId]);
    }

    const entries = await Promise.all([...idsByUser].map(async ([userId, ids]) => (
      [userId, await this.repositories.projectSummaries(userId, ids)] as const
    )));

    return new Map(entries);
  }
}
