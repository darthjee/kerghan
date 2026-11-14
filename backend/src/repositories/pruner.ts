import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

const PRUNE_SQL = 'DELETE FROM repositories WHERE user_id = ? AND added_at IS NULL AND NOT EXISTS ('
  + 'SELECT 1 FROM repositories_sources s WHERE s.user_id = ? AND s.repository_id = repositories.id)';

/**
 * The private-metadata lifecycle's writes (see
 * `docs/agents/modules/repositories.md#private-metadata-lifecycle`): dropping a
 * source's rows and pruning not-added repos left with no source row. Every
 * statement is scoped `user_id = :userId`; callers run them inside their own
 * transaction.
 */
@Injectable()
export class Pruner {
  /**
   * Deletes the not-added repos of a user that no source row points at.
   * Added repos are never deleted (they read Unavailable).
   * @param {EntityManager} manager - The caller's transactional manager.
   * @param {number} userId - The user.
   * @returns {Promise<number>} How many repos were pruned.
   */
  async prune(manager: EntityManager, userId: number): Promise<number> {
    const result: { affectedRows?: number } = await manager.query(PRUNE_SQL, [userId, userId]);

    return result.affectedRows ?? 0;
  }

  /**
   * Deletes the source, page and status rows of the given sources of a user.
   * @param {EntityManager} manager - The caller's transactional manager.
   * @param {number} userId - The user.
   * @param {string[]} sourceKeys - The source keys to drop.
   * @returns {Promise<void>} Resolves once deleted.
   */
  async dropSources(manager: EntityManager, userId: number, sourceKeys: string[]): Promise<void> {
    if (sourceKeys.length === 0) return;

    for (const table of ['repositories_sources', 'repositories_source_pages', 'repositories_source_statuses']) {
      await manager.query(`DELETE FROM ${table} WHERE user_id = ? AND source_key IN (?)`, [userId, sourceKeys]);
    }
  }
}
