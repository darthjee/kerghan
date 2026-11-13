import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { Clock } from '../core/clock.js';
import type { GithubRepo } from '../integrations/integrations-github.public.js';
import type { SourceStatus } from './entities/repository-source-status.entity.js';
import { HANDLE_SOURCE_KEY } from './source-key.js';
import { type GuardOutcome, SyncStateStore } from './sync-state.store.js';

/** The run, the source and the guard of one write. */
export interface WriteTarget {
  userId: number;
  runId: string;
  sourceKey: string;
  /** The handle the run started with (handle source only). */
  handleGuard?: { handle: string | null };
}

/** A stored page row. */
export interface StoredPage {
  etag: string | null;
  hasNext: boolean;
}

/** How a source ended: applied up to `lastPage`, or failed. */
export type SourceEndWrite =
  | { kind: 'success'; lastPage: number; status: Extract<SourceStatus, 'ok' | 'page_cap_reached'> }
  | { kind: 'failure'; status: Exclude<SourceStatus, 'ok' | 'page_cap_reached'>; resetAt: Date | null };

/**
 * The guarded per-page and end-of-source transactions of a sync run
 * (`docs/agents/specs/repos/sync.md#write-path`). Each transaction's first
 * statement is the run's guard (heartbeat, conditional on `run_id` and, for
 * the handle source, on the handle); when it no longer owns the row nothing
 * is written. Every statement is scoped `user_id = :userId`.
 */
@Injectable()
export class PageWriter {
  /**
   * @param {DataSource} dataSource - The connection (transactions).
   * @param {SyncStateStore} store - The run guard.
   * @param {Clock} clock - The time source.
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly store: SyncStateStore,
    private readonly clock: Clock,
  ) {}

  /**
   * Reads a source's stored pages.
   * @param {number} userId - The user.
   * @param {string} sourceKey - The source.
   * @returns {Promise<Map<number, StoredPage>>} The pages, by number.
   */
  async storedPages(userId: number, sourceKey: string): Promise<Map<number, StoredPage>> {
    const rows: Array<{ page: number; etag: string | null; has_next: number }> = await this.dataSource.query(
      'SELECT page, etag, has_next FROM repositories_source_pages WHERE user_id = ? AND source_key = ?',
      [userId, sourceKey],
    );

    return new Map(rows.map((row) => [Number(row.page), { etag: row.etag, hasNext: Number(row.has_next) === 1 }]));
  }

  /**
   * The `rate_limited` sources of a user whose stored reset is still ahead
   * (skipped by the next run with no call).
   * @param {number} userId - The user.
   * @param {Date} now - The current time.
   * @returns {Promise<string[]>} Their source keys.
   */
  async rateLimitedSources(userId: number, now: Date): Promise<string[]> {
    const rows: Array<{ source_key: string }> = await this.dataSource.query(
      "SELECT source_key FROM repositories_source_statuses WHERE user_id = ? AND status = 'rate_limited' AND reset_at > ?",
      [userId, now],
    );

    return rows.map((row) => row.source_key);
  }

  /**
   * Applies a `200` page: upserts its repos, drops the `handle` row of the
   * private ones (integration sources), rewrites the page's source rows and
   * stores its `etag` / `has_next`.
   * @param {WriteTarget} target - The run and source.
   * @param {number} page - The page number.
   * @param {GithubRepo[]} repos - The page's repos (the handle source already dropped private ones).
   * @param {StoredPage} stored - The page's new `etag` / `has_next`.
   * @returns {Promise<GuardOutcome>} `owned` when applied.
   */
  applyPage(target: WriteTarget, page: number, repos: GithubRepo[], stored: StoredPage): Promise<GuardOutcome> {
    return this.#guarded(target, async (manager, now) => {
      const ids = await this.#upsertRepos(manager, target.userId, repos, now);
      const privateIds = repos.filter((repo) => repo.private).map((repo) => ids.get(repo.githubId) as number);

      if (target.sourceKey !== HANDLE_SOURCE_KEY && privateIds.length > 0) {
        await manager.query(
          'DELETE FROM repositories_sources WHERE user_id = ? AND source_key = ? AND repository_id IN (?)',
          [target.userId, HANDLE_SOURCE_KEY, privateIds],
        );
      }
      await this.#rewriteSourceRows(manager, target, page, [...ids.values()]);
      await manager.query(
        'INSERT INTO repositories_source_pages (user_id, source_key, page, etag, has_next, fetched_at) VALUES (?, ?, ?, ?, ?, ?) '
        + 'AS new ON DUPLICATE KEY UPDATE etag = new.etag, has_next = new.has_next, fetched_at = new.fetched_at',
        [target.userId, target.sourceKey, page, stored.etag, stored.hasNext, now],
      );
    });
  }

  /**
   * Applies a `304`: keeps the page's source rows and sets their repos'
   * `last_seen_at`; `owner` / `name` / `private` are untouched.
   * @param {WriteTarget} target - The run and source.
   * @param {number} page - The page number.
   * @returns {Promise<GuardOutcome>} `owned` when applied.
   */
  applyNotModified(target: WriteTarget, page: number): Promise<GuardOutcome> {
    return this.#guarded(target, async (manager, now) => {
      await manager.query(
        'UPDATE repositories SET last_seen_at = ? WHERE user_id = ? AND id IN ('
        + 'SELECT repository_id FROM repositories_sources WHERE user_id = ? AND source_key = ? AND page = ?)',
        [now, target.userId, target.userId, target.sourceKey, page],
      );
      await manager.query(
        'UPDATE repositories_source_pages SET fetched_at = ? WHERE user_id = ? AND source_key = ? AND page = ?',
        [now, target.userId, target.sourceKey, page],
      );
    });
  }

  /**
   * Ends a source: on success (or the page cap) deletes its source and page
   * rows past its last page; stores its status either way.
   * @param {WriteTarget} target - The run and source.
   * @param {SourceEndWrite} end - How it ended.
   * @returns {Promise<GuardOutcome>} `owned` when written.
   */
  endSource(target: WriteTarget, end: SourceEndWrite): Promise<GuardOutcome> {
    return this.#guarded(target, async (manager, now) => {
      if (end.kind === 'success') {
        for (const table of ['repositories_sources', 'repositories_source_pages']) {
          await manager.query(`DELETE FROM ${table} WHERE user_id = ? AND source_key = ? AND page > ?`,
            [target.userId, target.sourceKey, end.lastPage]);
        }
      }
      await manager.query(
        'INSERT INTO repositories_source_statuses (user_id, source_key, status, synced_at, reset_at) VALUES (?, ?, ?, ?, ?) '
        + 'AS new ON DUPLICATE KEY UPDATE status = new.status, synced_at = new.synced_at, reset_at = new.reset_at',
        [target.userId, target.sourceKey, end.status, now, end.kind === 'failure' ? end.resetAt : null],
      );
    });
  }

  /**
   * Runs writes in one transaction behind the run's guard.
   * @param {WriteTarget} target - The run and source.
   * @param {Function} writes - The writes, given the manager and `now`.
   * @returns {Promise<GuardOutcome>} The guard's outcome (writes run only when `owned`).
   */
  #guarded(target: WriteTarget, writes: (manager: EntityManager, now: Date) => Promise<void>): Promise<GuardOutcome> {
    return this.dataSource.transaction(async (manager) => {
      const outcome = await this.store.guard(manager, target.userId, target.runId, target.handleGuard);

      if (outcome === 'owned') await writes(manager, this.clock.now());

      return outcome;
    });
  }

  /**
   * Upserts a page's repos on (`user_id`, `github_id`), never touching
   * `added_at` or `integration_id`, then maps them to row ids.
   * @param {EntityManager} manager - The transaction.
   * @param {number} userId - The user.
   * @param {GithubRepo[]} repos - The repos.
   * @param {Date} now - The write time.
   * @returns {Promise<Map<number, number>>} Row id by `github_id`.
   */
  async #upsertRepos(manager: EntityManager, userId: number, repos: GithubRepo[], now: Date): Promise<Map<number, number>> {
    if (repos.length === 0) return new Map();

    await manager.query(
      'INSERT INTO repositories (user_id, github_id, owner, name, private, last_seen_at, created_at, updated_at) VALUES '
      + repos.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
      + ' AS new ON DUPLICATE KEY UPDATE owner = new.owner, name = new.name, private = new.private, '
      + 'last_seen_at = new.last_seen_at, updated_at = new.updated_at',
      repos.flatMap((repo) => [userId, repo.githubId, repo.owner, repo.name, repo.private, now, now, now]),
    );

    const rows: Array<{ id: number; github_id: string }> = await manager.query(
      'SELECT id, github_id FROM repositories WHERE user_id = ? AND github_id IN (?)',
      [userId, repos.map((repo) => repo.githubId)],
    );

    return new Map(rows.map((row) => [Number(row.github_id), row.id]));
  }

  /**
   * Rewrites one page's source rows: drops the rows no longer on it and
   * upserts the page's repos onto it (a repo moved from another page moves).
   * @param {EntityManager} manager - The transaction.
   * @param {WriteTarget} target - The run and source.
   * @param {number} page - The page.
   * @param {number[]} repositoryIds - The page's row ids.
   * @returns {Promise<void>} Resolves once rewritten.
   */
  async #rewriteSourceRows(manager: EntityManager, target: WriteTarget, page: number, repositoryIds: number[]): Promise<void> {
    const keep = repositoryIds.length > 0 ? ' AND repository_id NOT IN (?)' : '';

    await manager.query(
      `DELETE FROM repositories_sources WHERE user_id = ? AND source_key = ? AND page = ?${keep}`,
      [target.userId, target.sourceKey, page, ...(repositoryIds.length > 0 ? [repositoryIds] : [])],
    );
    if (repositoryIds.length === 0) return;

    await manager.query(
      'INSERT INTO repositories_sources (user_id, repository_id, source_key, page) VALUES '
      + repositoryIds.map(() => '(?, ?, ?, ?)').join(', ')
      + ' AS new ON DUPLICATE KEY UPDATE page = new.page',
      repositoryIds.flatMap((id) => [target.userId, id, target.sourceKey, page]),
    );
  }
}
