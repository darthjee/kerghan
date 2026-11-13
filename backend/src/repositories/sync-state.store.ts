import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { AccountHandleService } from '../auth/account-handle.service.js';
import { Clock } from '../core/clock.js';
import { RepositorySyncState } from './entities/repository-sync-state.entity.js';
import { RepositoriesConfig, SYNC_LEASE_MS } from './repositories-config.js';

/** What triggered a claim: a stale listing (adds the TTL clause) or Refresh. */
export type ClaimMode = 'stale' | 'refresh';

/** The outcome of a claim. `missing`: the user has no sync-state row. */
export type ClaimOutcome =
  | { kind: 'started'; runId: string }
  | { kind: 'running'; startedAt: Date }
  | { kind: 'cooldown'; lastStartedAt: Date }
  | { kind: 'fresh' }
  | { kind: 'missing' };

/** The outcome of a run's page guard. */
export type GuardOutcome = 'owned' | 'lost' | 'handle_changed';

/** The sync-state row as read by the API, with a dead lease reported `idle`. */
export interface SyncStateView {
  exists: boolean;
  state: 'idle' | 'syncing';
  lastStartedAt: Date | null;
  lastSyncedAt: Date | null;
  handle: string | null;
}

const TABLE = 'repositories_sync_states';

/**
 * The per-user sync lock (see `docs/agents/specs/repos/sync.md#per-user-lock`
 * and `#restart-recovery`): row creation for request entry points, the
 * atomic claim, the `run_id`-guarded writes of a run and the lease-aware
 * read. Every time value comes from the injected `Clock` and is passed to SQL
 * as a parameter.
 */
@Injectable()
export class SyncStateStore {
  /**
   * @param {DataSource} dataSource - The connection (transactions).
   * @param {AccountHandleService} accountHandle - Auth's export (user-exists lock).
   * @param {Clock} clock - The time source.
   * @param {RepositoriesConfig} config - The TTL and cooldown.
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly accountHandle: AccountHandleService,
    private readonly clock: Clock,
    private readonly config: RepositoriesConfig,
  ) {}

  /**
   * Creates the user's sync-state row if missing, only while the user still
   * exists (checked in the same transaction under a shared lock).
   * Request entry points only: a run never creates the row.
   * @param {number} userId - The user.
   * @returns {Promise<boolean>} `false` when the user no longer exists.
   */
  ensureRow(userId: number): Promise<boolean> {
    return this.dataSource.transaction((manager) => this.ensureRowIn(manager, userId));
  }

  /**
   * `ensureRow` inside the caller's transaction.
   * @param {EntityManager} manager - The caller's transactional manager.
   * @param {number} userId - The user.
   * @returns {Promise<boolean>} `false` when the user no longer exists.
   */
  async ensureRowIn(manager: EntityManager, userId: number): Promise<boolean> {
    if (!(await this.accountHandle.lockExistingUser(userId, manager))) return false;

    await manager.query(
      `INSERT INTO ${TABLE} (user_id, state) VALUES (?, 'idle') ON DUPLICATE KEY UPDATE user_id = user_id`,
      [userId],
    );

    return true;
  }

  /**
   * The atomic claim; on zero rows, re-reads the row to tell a running sync
   * from the cooldown, retrying once when the run ended in between.
   * @param {number} userId - The user.
   * @param {ClaimMode} mode - `stale` (adds the TTL clause) or `refresh`.
   * @returns {Promise<ClaimOutcome>} The outcome.
   */
  async claim(userId: number, mode: ClaimMode): Promise<ClaimOutcome> {
    const first = await this.#attempt(userId, mode);

    if (first.outcome !== null) return first.outcome;

    const second = await this.#attempt(userId, mode);

    // Two zero-row claims around an idle, out-of-cooldown row: another trigger won in between.
    return second.outcome ?? { kind: 'cooldown', lastStartedAt: second.row?.lastStartedAt ?? this.clock.now() };
  }

  /**
   * The page guard of a run, inside its page transaction: bumps the
   * heartbeat (which locks the row), conditional on `run_id` and, for the
   * handle source, on the handle the run started with.
   * @param {EntityManager} manager - The page transaction.
   * @param {number} userId - The user.
   * @param {string} runId - The run.
   * @param {{ handle: string | null }} [handleGuard] - The run's handle (handle source only).
   * @returns {Promise<GuardOutcome>} Whether the run still owns the row.
   */
  async guard(
    manager: EntityManager,
    userId: number,
    runId: string,
    handleGuard?: { handle: string | null },
  ): Promise<GuardOutcome> {
    const handleClause = handleGuard === undefined ? '' : ' AND handle <=> ?';
    const params: unknown[] = [this.clock.now(), userId, runId];

    if (handleGuard !== undefined) params.push(handleGuard.handle);

    const result: { affectedRows: number } = await manager.query(
      `UPDATE ${TABLE} SET heartbeat_at = ? WHERE user_id = ? AND run_id = ?${handleClause}`,
      params,
    );

    if (result.affectedRows === 1) return 'owned';
    if (handleGuard === undefined) return 'lost';

    const rows: Array<{ run_id: string | null }> = await manager.query(
      `SELECT run_id FROM ${TABLE} WHERE user_id = ? FOR UPDATE`,
      [userId],
    );

    return rows[0]?.run_id === runId ? 'handle_changed' : 'lost';
  }

  /**
   * Bumps the heartbeat of a run, outside any page transaction.
   * @param {number} userId - The user.
   * @param {string} runId - The run.
   * @returns {Promise<boolean>} `false` when the run lost its lease or its row.
   */
  async heartbeat(userId: number, runId: string): Promise<boolean> {
    return (await this.guard(this.dataSource.manager, userId, runId)) === 'owned';
  }

  /**
   * Ends a run: `idle`, `run_id` cleared, `last_synced_at = now`.
   * @param {EntityManager} manager - The end-of-sync transaction.
   * @param {number} userId - The user.
   * @param {string} runId - The run.
   * @returns {Promise<boolean>} `false` when the run lost its lease or its row.
   */
  async finish(manager: EntityManager, userId: number, runId: string): Promise<boolean> {
    const result: { affectedRows: number } = await manager.query(
      `UPDATE ${TABLE} SET state = 'idle', run_id = NULL, last_synced_at = ? WHERE user_id = ? AND run_id = ?`,
      [this.clock.now(), userId, runId],
    );

    return result.affectedRows === 1;
  }

  /**
   * The catch-all release: `idle` and `run_id` cleared, never
   * `last_synced_at`, and only while the run still owns the row.
   * @param {number} userId - The user.
   * @param {string} runId - The run.
   * @returns {Promise<boolean>} Whether a row was released.
   */
  async release(userId: number, runId: string): Promise<boolean> {
    const result: { affectedRows: number } = await this.dataSource.query(
      `UPDATE ${TABLE} SET state = 'idle', run_id = NULL WHERE user_id = ? AND run_id = ?`,
      [userId, runId],
    );

    return result.affectedRows === 1;
  }

  /**
   * Reads the sync state; a `syncing` row whose lease expired reads `idle`.
   * @param {number} userId - The user.
   * @returns {Promise<SyncStateView>} The view (`exists: false` with no row).
   */
  async readState(userId: number): Promise<SyncStateView> {
    const row = await this.#read(userId);

    if (row === null) {
      return { exists: false, state: 'idle', lastStartedAt: null, lastSyncedAt: null, handle: null };
    }

    return {
      exists: true,
      state: this.#isLive(row) ? 'syncing' : 'idle',
      lastStartedAt: row.lastStartedAt,
      lastSyncedAt: row.lastSyncedAt,
      handle: row.handle,
    };
  }

  /**
   * One claim attempt and, on zero rows, the re-read.
   * @param {number} userId - The user.
   * @param {ClaimMode} mode - The trigger.
   * @returns {Promise<{ outcome: ClaimOutcome | null, row: RepositorySyncState | null }>} The
   *   outcome (`null`: idle and out of the cooldown, retry) and the re-read row.
   */
  async #attempt(userId: number, mode: ClaimMode): Promise<{ outcome: ClaimOutcome | null; row: RepositorySyncState | null }> {
    const runId = randomUUID();

    if (await this.#tryClaim(userId, mode, runId)) return { outcome: { kind: 'started', runId }, row: null };

    const row = await this.#read(userId);

    return { outcome: this.#classify(row, mode), row };
  }

  /**
   * The conditional `UPDATE` of the claim.
   * @param {number} userId - The user.
   * @param {ClaimMode} mode - The trigger.
   * @param {string} runId - The new run's id.
   * @returns {Promise<boolean>} Whether this call took the lock.
   */
  async #tryClaim(userId: number, mode: ClaimMode, runId: string): Promise<boolean> {
    const now = this.clock.now();
    const query = this.dataSource.createQueryBuilder()
      .update(RepositorySyncState)
      .set({ state: 'syncing', lastStartedAt: now, heartbeatAt: now, runId })
      .where('user_id = :userId', { userId })
      .andWhere("(state = 'idle' OR heartbeat_at < :leaseThreshold)", { leaseThreshold: this.#ago(now, SYNC_LEASE_MS) })
      .andWhere('(last_started_at IS NULL OR last_started_at < :cooldownThreshold)', {
        cooldownThreshold: this.#ago(now, this.config.cooldownMs),
      });

    if (mode === 'stale') {
      query.andWhere('(last_synced_at IS NULL OR last_synced_at < :ttlThreshold)', {
        ttlThreshold: this.#ago(now, this.config.ttlMs),
      });
    }

    return (await query.execute()).affected === 1;
  }

  /**
   * Classifies a zero-row claim from the re-read row.
   * @param {RepositorySyncState | null} row - The re-read row.
   * @param {ClaimMode} mode - The trigger.
   * @returns {ClaimOutcome | null} The outcome, or `null` to retry the claim.
   */
  #classify(row: RepositorySyncState | null, mode: ClaimMode): ClaimOutcome | null {
    if (row === null) return { kind: 'missing' };
    if (this.#isLive(row)) return { kind: 'running', startedAt: row.lastStartedAt as Date };

    const now = this.clock.now();

    if (row.lastStartedAt !== null && row.lastStartedAt >= this.#ago(now, this.config.cooldownMs)) {
      return { kind: 'cooldown', lastStartedAt: row.lastStartedAt };
    }
    if (mode === 'stale' && row.lastSyncedAt !== null && row.lastSyncedAt >= this.#ago(now, this.config.ttlMs)) {
      return { kind: 'fresh' };
    }

    return null;
  }

  /**
   * Whether a row holds a live lock (`syncing` with a heartbeat within the lease).
   * @param {RepositorySyncState} row - The row.
   * @returns {boolean} `true` while a run holds it.
   */
  #isLive(row: RepositorySyncState): boolean {
    return row.state === 'syncing' && row.heartbeatAt !== null
      && row.heartbeatAt >= this.#ago(this.clock.now(), SYNC_LEASE_MS);
  }

  /**
   * @param {number} userId - The user.
   * @returns {Promise<RepositorySyncState | null>} The row, or `null`.
   */
  #read(userId: number): Promise<RepositorySyncState | null> {
    return this.dataSource.getRepository(RepositorySyncState).findOneBy({ userId });
  }

  /**
   * @param {Date} now - The reference time.
   * @param {number} ms - A duration.
   * @returns {Date} `now - ms`.
   */
  #ago(now: Date, ms: number): Date {
    return new Date(now.getTime() - ms);
  }
}
