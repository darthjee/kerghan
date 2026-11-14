import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Clock } from '../core/clock.js';
import type { RepoRef, RepositorySnapshot } from './types/repositories-api.types.js';

/** A resolved row: its internal id never leaves the module. */
export interface ResolvedRow {
  id: number;
}

/** How a conditional mark ended. */
export type MarkResult = 'added' | 'already_added' | 'gone';

/**
 * Add's row lookup and conditional write (`docs/agents/backend/routes/repositories.md#add`
 * and `#repo-ref`), over the caller's own rows only.
 */
@Injectable()
export class AddStore {
  /**
   * @param {DataSource} dataSource - The connection.
   * @param {Clock} clock - The time source (`added_at`).
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly clock: Clock,
  ) {}

  /**
   * Resolves a ref among the user's rows. `fullName` matches `owner/name`
   * case-insensitively; a tie breaks on the latest `last_seen_at`, then the
   * highest `id`.
   * @param {number} userId - The user.
   * @param {RepoRef} ref - The ref.
   * @returns {Promise<ResolvedRow | null>} The row, or `null`.
   */
  async resolve(userId: number, ref: RepoRef): Promise<ResolvedRow | null> {
    if ('githubId' in ref) {
      return this.#first('SELECT id FROM repositories WHERE user_id = ? AND github_id = ?', [userId, ref.githubId]);
    }

    const parts = ref.fullName.split('/');

    if (parts.length !== 2) return null;

    return this.#first(
      'SELECT id FROM repositories WHERE user_id = ? AND LOWER(owner) = LOWER(?) AND LOWER(name) = LOWER(?) '
      + 'ORDER BY last_seen_at DESC, id DESC LIMIT 1',
      [userId, parts[0], parts[1]],
    );
  }

  /**
   * The conditional mark: only a not-added row of the user is written; on
   * zero rows the row is re-read to tell a concurrent Add from a prune.
   * @param {number} userId - The user.
   * @param {ResolvedRow} row - The row.
   * @param {number | null} integrationId - The access link.
   * @param {RepositorySnapshot} [snapshot] - The re-check's metadata, stored with the mark.
   * @returns {Promise<MarkResult>} The outcome.
   */
  async mark(userId: number, row: ResolvedRow, integrationId: number | null, snapshot?: RepositorySnapshot): Promise<MarkResult> {
    const now = this.clock.now();
    const set = snapshot === undefined ? '' : ', owner = ?, name = ?, private = ?';
    const result: { affectedRows: number } = await this.dataSource.query(
      `UPDATE repositories SET added_at = ?, integration_id = ?, updated_at = ?${set} WHERE id = ? AND user_id = ? AND added_at IS NULL`,
      [now, integrationId, now, ...(snapshot === undefined ? [] : [snapshot.owner, snapshot.name, snapshot.private]), row.id, userId],
    );

    if (result.affectedRows === 1) return 'added';

    return (await this.#first('SELECT id FROM repositories WHERE id = ? AND user_id = ?', [row.id, userId])) === null
      ? 'gone'
      : 'already_added';
  }

  /**
   * @param {string} sql - A `SELECT id …` query.
   * @param {unknown[]} params - Its parameters.
   * @returns {Promise<ResolvedRow | null>} The first row, or `null`.
   */
  async #first(sql: string, params: unknown[]): Promise<ResolvedRow | null> {
    const rows: Array<{ id: number }> = await this.dataSource.query(sql, params);

    return rows.length === 0 ? null : { id: rows[0].id };
  }
}
