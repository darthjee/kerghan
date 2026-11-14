import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { OK_SOURCE_STATUSES } from './entities/repository-source-status.entity.js';
import { integrationSourceKey } from './source-key.js';

/**
 * The end-of-sync link fill (`docs/agents/modules/repositories/sync.md#link-fill`):
 * an added private repo with an empty or dangling `integration_id` is linked
 * to the oldest usable integration holding a source row for it from a source
 * whose status is `ok` or `page_cap_reached`. It never changes an existing
 * link, a public repo or a not-added repo.
 */
@Injectable()
export class LinkFiller {
  /**
   * Fills the empty or dangling links of a user's added private repos.
   * @param {EntityManager} manager - The end-of-sync transaction.
   * @param {number} userId - The user.
   * @param {number[]} usableIds - The usable integration ids, oldest first.
   * @param {number[]} allIds - Every integration id of the user.
   * @returns {Promise<number>} How many links were filled.
   */
  async fill(manager: EntityManager, userId: number, usableIds: number[], allIds: number[]): Promise<number> {
    if (usableIds.length === 0) return 0;

    const candidates: Array<{ id: number }> = await manager.query(
      'SELECT id FROM repositories WHERE user_id = ? AND added_at IS NOT NULL AND private = true '
      + 'AND (integration_id IS NULL OR integration_id NOT IN (?))',
      [userId, allIds],
    );

    if (candidates.length === 0) return 0;

    const holders = await this.#okHolders(manager, userId, candidates.map((row) => row.id));
    let filled = 0;

    for (const { id } of candidates) {
      const integrationId = usableIds.find((usable) => holders.get(id)?.has(integrationSourceKey(usable)));

      if (integrationId !== undefined) filled += await this.#link(manager, userId, id, integrationId, allIds);
    }

    return filled;
  }

  /**
   * The ok source keys holding a row for each candidate.
   * @param {EntityManager} manager - The transaction.
   * @param {number} userId - The user.
   * @param {number[]} repositoryIds - The candidates.
   * @returns {Promise<Map<number, Set<string>>>} Source keys by repository id.
   */
  async #okHolders(manager: EntityManager, userId: number, repositoryIds: number[]): Promise<Map<number, Set<string>>> {
    const rows: Array<{ repository_id: number; source_key: string }> = await manager.query(
      'SELECT s.repository_id, s.source_key FROM repositories_sources s '
      + 'JOIN repositories_source_statuses st ON st.user_id = s.user_id AND st.source_key = s.source_key '
      + 'WHERE s.user_id = ? AND s.repository_id IN (?) AND st.status IN (?)',
      [userId, repositoryIds, OK_SOURCE_STATUSES],
    );
    const holders = new Map<number, Set<string>>();

    for (const row of rows) {
      holders.set(row.repository_id, (holders.get(row.repository_id) ?? new Set()).add(row.source_key));
    }

    return holders;
  }

  /**
   * The conditional link write: matches only an empty or dangling link.
   * @param {EntityManager} manager - The transaction.
   * @param {number} userId - The user.
   * @param {number} repositoryId - The repo.
   * @param {number} integrationId - The link.
   * @param {number[]} allIds - Every integration id of the user.
   * @returns {Promise<number>} 1 when written.
   */
  async #link(manager: EntityManager, userId: number, repositoryId: number, integrationId: number, allIds: number[]): Promise<number> {
    const result: { affectedRows: number } = await manager.query(
      'UPDATE repositories SET integration_id = ? WHERE user_id = ? AND id = ? AND added_at IS NOT NULL AND private = true '
      + 'AND (integration_id IS NULL OR integration_id NOT IN (?))',
      [integrationId, userId, repositoryId, allIds],
    );

    return result.affectedRows;
  }
}
