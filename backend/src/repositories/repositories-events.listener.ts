import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
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
 * (`docs/agents/specs/repos/integrations.md#deletion-hook`) and
 * `user.deleted` (`docs/agents/specs/repos/model.md#user-deletion`). Each
 * runs one transaction where every statement is scoped `user_id = :userId`,
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
 * @param {unknown} error - A caught value.
 * @returns {string} Its class name (never its message).
 */
function errorClass(error: unknown): string {
  return error instanceof Error ? error.constructor.name : typeof error;
}
