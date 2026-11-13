import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { AccountHandleService } from '../auth/account-handle.service.js';
import { RepositorySyncState } from './entities/repository-sync-state.entity.js';
import { Pruner } from './pruner.js';
import { HANDLE_SOURCE_KEY } from './source-key.js';
import { SyncStateStore } from './sync-state.store.js';

/** A request entry point's reconciliation outcome. */
export type RequestReconciliation = { kind: 'ok'; handle: string | null } | { kind: 'no_user' };

/** A run's start-of-run reconciliation outcome. */
export type RunReconciliation = { kind: 'ok'; handle: string | null } | { kind: 'no_row' };

/**
 * The lazy handle reconciliation (see
 * `docs/agents/specs/repos/model.md#handle-changes`): compares the current
 * handle (read through Auth's export) with `repositories_sync_states.handle`
 * and, when they differ, drops the old handle's source, page and status rows,
 * stores the new handle and prunes, in one transaction. It triggers no sync
 * and never touches `last_started_at`.
 */
@Injectable()
export class HandleReconciler {
  /**
   * @param {DataSource} dataSource - The connection (transactions).
   * @param {AccountHandleService} accountHandle - Auth's export.
   * @param {SyncStateStore} store - Row creation (request entry points).
   * @param {Pruner} pruner - Source-row drops and pruning.
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly accountHandle: AccountHandleService,
    private readonly store: SyncStateStore,
    private readonly pruner: Pruner,
  ) {}

  /**
   * For request entry points (listing, sync state, Refresh, Add): creates
   * the sync-state row when missing, only for a user that still exists.
   * @param {number} userId - The session's user.
   * @returns {Promise<RequestReconciliation>} The current handle, or `no_user`.
   */
  async forRequest(userId: number): Promise<RequestReconciliation> {
    const current = await this.accountHandle.getGithubHandle(userId);

    // A missing row still goes through the transaction: request entry points create it.
    if (await this.#stored(userId) === current) return { kind: 'ok', handle: current };

    return this.dataSource.transaction(async (manager) => {
      if (!(await this.store.ensureRowIn(manager, userId))) return { kind: 'no_user' };

      await this.#reconcileLocked(manager, userId, current);

      return { kind: 'ok', handle: current };
    });
  }

  /**
   * For a sync run when it starts: only locks an existing row, never creates
   * one; with no row the run stops.
   * @param {number} userId - The run's user.
   * @returns {Promise<RunReconciliation>} The handle the run starts with, or `no_row`.
   */
  async forRun(userId: number): Promise<RunReconciliation> {
    const current = await this.accountHandle.getGithubHandle(userId);
    const stored = await this.#stored(userId);

    if (stored === undefined) return { kind: 'no_row' };
    if (stored === current) return { kind: 'ok', handle: current };

    return this.dataSource.transaction(async (manager) => (
      await this.#reconcileLocked(manager, userId, current)
        ? { kind: 'ok', handle: current }
        : { kind: 'no_row' }
    ));
  }

  /**
   * Locks the row (`FOR UPDATE`), re-compares under the lock and, when still
   * different, drops the handle rows, stores the handle and prunes.
   * @param {EntityManager} manager - The transaction.
   * @param {number} userId - The user.
   * @param {string | null} current - The current handle.
   * @returns {Promise<boolean>} `false` when there is no row.
   */
  async #reconcileLocked(manager: EntityManager, userId: number, current: string | null): Promise<boolean> {
    const rows: Array<{ handle: string | null }> = await manager.query(
      'SELECT handle FROM repositories_sync_states WHERE user_id = ? FOR UPDATE',
      [userId],
    );

    if (rows.length === 0) return false;
    if (rows[0].handle === current) return true;

    await this.pruner.dropSources(manager, userId, [HANDLE_SOURCE_KEY]);
    await manager.query('UPDATE repositories_sync_states SET handle = ? WHERE user_id = ?', [current, userId]);
    await this.pruner.prune(manager, userId);

    return true;
  }

  /**
   * @param {number} userId - The user.
   * @returns {Promise<string | null | undefined>} The stored handle, or `undefined` with no row.
   */
  async #stored(userId: number): Promise<string | null | undefined> {
    const row = await this.dataSource.getRepository(RepositorySyncState).findOne({
      where: { userId },
      select: { userId: true, handle: true },
    });

    return row === null ? undefined : row.handle;
  }
}
