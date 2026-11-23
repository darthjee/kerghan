import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource, type EntityManager } from 'typeorm';
import { USER_DELETED, UserDeletedEvent } from '../auth/events/user-deleted.event.js';
import { LoggerService } from '../core/logger.service.js';

const USER_PROJECT_IDS = 'SELECT id FROM issues_projects WHERE user_id = ?';
const USER_LINK_IDS = 'SELECT id FROM issues_github_links WHERE user_id = ?';

/**
 * The Issues module's cross-module cleanup, registered at boot (the module is always-on):
 * `user.deleted` (`docs/agents/modules/issues/data-model.md#cleanup`). It runs one transaction where
 * every statement is scoped to the user, takes the locks in the module's lock order (projects,
 * then issues, then links, then markers) and deletes children first. It catches its own error and
 * logs safe fields only, so the emitter's deletion always stands. There is no
 * `integration.deleted` hook: nothing in the module stores an integration id.
 */
@Injectable()
export class IssuesEventsListener {
  /**
   * @param {DataSource} dataSource - The connection (transactions).
   * @param {LoggerService} logger - Safe-field logs only.
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Deletes every Issues row of a deleted user (markers, links, issues and projects, soft-deleted
   * ones included) in one transaction. Never throws: a failure is logged at error level with the
   * user id and the error class only, and never blocks the user deletion.
   * @param {UserDeletedEvent} event - `{ userId }`.
   * @returns {Promise<void>} Resolves once the cleanup committed or failed.
   */
  @OnEvent(USER_DELETED)
  async onUserDeleted(event: UserDeletedEvent): Promise<void> {
    const { userId } = event;

    try {
      await this.dataSource.transaction(async (manager) => {
        await lockUserRows(manager, userId);
        await manager.query(`DELETE FROM issues_pending_writes WHERE link_id IN (${USER_LINK_IDS})`, [userId]);
        await manager.query('DELETE FROM issues_github_links WHERE user_id = ?', [userId]);
        await manager.query(`DELETE FROM issues WHERE project_id IN (${USER_PROJECT_IDS})`, [userId]);
        await manager.query('DELETE FROM issues_projects WHERE user_id = ?', [userId]);
      });
    } catch (error) {
      this.logger.error('issues user.deleted cleanup failed', {
        context: 'IssuesEventsListener',
        userId,
        errorClass: errorClass(error),
      });
    }
  }
}

/**
 * Locks the user's rows in the module's lock order: projects (soft-deleted ones included), then
 * their issues, then the links, then the markers, so the cleanup serializes with a running job or
 * a project deletion instead of deadlocking with them.
 * @param {EntityManager} manager - The transaction.
 * @param {number} userId - The user.
 * @returns {Promise<void>} Resolves once locked (or with no rows).
 */
async function lockUserRows(manager: EntityManager, userId: number): Promise<void> {
  await manager.query(`${USER_PROJECT_IDS} FOR UPDATE`, [userId]);
  await manager.query(`SELECT id FROM issues WHERE project_id IN (${USER_PROJECT_IDS}) FOR UPDATE`, [userId]);
  await manager.query(`${USER_LINK_IDS} FOR UPDATE`, [userId]);
  await manager.query(`SELECT id FROM issues_pending_writes WHERE link_id IN (${USER_LINK_IDS}) FOR UPDATE`, [userId]);
}

/**
 * @param {unknown} error - A caught value.
 * @returns {string} Its class name (never its message).
 */
function errorClass(error: unknown): string {
  return error instanceof Error ? error.constructor.name : typeof error;
}
