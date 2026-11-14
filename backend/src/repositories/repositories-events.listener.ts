import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource, type EntityManager } from 'typeorm';
import { Pruner } from './pruner.js';
import { integrationSourceKey } from './source-key.js';
import { USER_DELETED, UserDeletedEvent } from '../auth/events/user-deleted.event.js';
import { LoggerService } from '../core/logger.service.js';
import { INTEGRATION_DELETED, IntegrationDeletedEvent } from '../integrations/integrations-github.public.js';

/** The five Repositories tables, children first. */
const USER_TABLES = [
  'repositories_sources',
  'repositories_source_pages',
  'repositories_source_statuses',
  'repositories',
  'repositories_sync_states',
];

/**
 * The Repositories module's cross-module cleanups, registered at boot (the
 * module is always-on): `integration.deleted`
 * (`docs/agents/modules/integrations/github-service.md#deletion-hook`) and
 * `user.deleted` (`docs/agents/modules/repositories.md#user-deletion`). Each
 * runs one transaction where every statement is scoped `user_id = :userId`
 * and the user's sync-state row is locked first (the shared lock order),
 * catches its own error and logs safe fields only, so the emitter's
 * deletion always stands.
 */
@Injectable()
export class RepositoriesEventsListener {
  /**
   * @param {DataSource} dataSource - The connection (transactions).
   * @param {Pruner} pruner - Source-row drops and pruning.
   * @param {LoggerService} logger - Safe-field logs only.
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly pruner: Pruner,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Drops a deleted integration's source, page and status rows, clears the
   * access links pointing at it, then prunes the not-added repos left with no
   * source row (added ones stay, reading Unavailable). Never throws.
   * @param {IntegrationDeletedEvent} event - `{ userId, integrationId }`.
   * @returns {Promise<void>} Resolves once the cleanup committed or failed.
   */
  @OnEvent(INTEGRATION_DELETED)
  async onIntegrationDeleted(event: IntegrationDeletedEvent): Promise<void> {
    const { userId, integrationId } = event;

    try {
      await this.dataSource.transaction(async (manager) => {
        await lockSyncState(manager, userId);
        await this.pruner.dropSources(manager, userId, [integrationSourceKey(integrationId)]);
        await manager.query(
          'UPDATE repositories SET integration_id = NULL WHERE user_id = ? AND integration_id = ?',
          [userId, integrationId],
        );
        await this.pruner.prune(manager, userId);
      });
    } catch (error) {
      this.logger.error('repositories integration.deleted cleanup failed', {
        context: 'RepositoriesEventsListener',
        userId,
        integrationId,
        errorClass: errorClass(error),
      });
    }
  }

  /**
   * Deletes every Repositories row of a deleted user, from all five tables,
   * in one transaction. Never throws.
   * @param {UserDeletedEvent} event - `{ userId }`.
   * @returns {Promise<void>} Resolves once the cleanup committed or failed.
   */
  @OnEvent(USER_DELETED)
  async onUserDeleted(event: UserDeletedEvent): Promise<void> {
    const { userId } = event;

    try {
      await this.dataSource.transaction(async (manager) => {
        await lockSyncState(manager, userId);
        for (const table of USER_TABLES) {
          await manager.query(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
        }
      });
    } catch (error) {
      this.logger.error('repositories user.deleted cleanup failed', {
        context: 'RepositoriesEventsListener',
        userId,
        errorClass: errorClass(error),
      });
    }
  }
}

/**
 * Locks the user's sync-state row first, the lock order every Repositories
 * write transaction follows (a run's guard, the reconciliation), so a
 * cleanup serializes with a running sync's page writes instead of
 * deadlocking with them.
 * @param {EntityManager} manager - The transaction.
 * @param {number} userId - The user.
 * @returns {Promise<void>} Resolves once locked (or with no row).
 */
async function lockSyncState(manager: EntityManager, userId: number): Promise<void> {
  await manager.query('SELECT user_id FROM repositories_sync_states WHERE user_id = ? FOR UPDATE', [userId]);
}

/**
 * @param {unknown} error - A caught value.
 * @returns {string} Its class name (never its message).
 */
function errorClass(error: unknown): string {
  return error instanceof Error ? error.constructor.name : typeof error;
}
