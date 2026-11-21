import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

/** The link statuses that keep syncing local edits (`gone` is edited locally only). */
const SYNCING_STATUSES = new Set(['linked', 'sync_failed']);

/**
 * The marker and link queries of the single Edit and the Delete (`docs/agents/specs/issues/sync.md#marker-lifecycle`).
 * Both run inside the caller's transaction, after the caller locked the issue row, and take the
 * next locks of the order (issues, links, markers).
 */
@Injectable()
export class IssueMarkers {
  /**
   * Bumps the pending marker of the issue's link after a value-changing edit. An unlinked issue
   * and a `gone` link get no marker (local edits only); a `linked` or `sync_failed` link gets one:
   * `marked_at` is set only on insert, while `revision` and `updated_at` move on every edit.
   * The caller calls it only when the edit changed a synced field.
   * @param {EntityManager} manager - The editing transaction's manager.
   * @param {number} issueId - The issue's internal id.
   * @param {Date} now - The edit's instant, in whole seconds (the `datetime` columns keep no fraction).
   * @returns {Promise<number | null>} The link id whose marker was bumped, or `null` when none was.
   */
  async upsertForEdit(manager: EntityManager, issueId: number, now: Date): Promise<number | null> {
    const rows: Array<{ id: number; status: string }> = await manager.query(
      'SELECT id, status FROM issues_github_links WHERE issue_id = ? FOR UPDATE',
      [issueId],
    );

    if (rows.length === 0 || !SYNCING_STATUSES.has(rows[0].status)) {
      return null;
    }

    await manager.query(
      'INSERT INTO issues_pending_writes (link_id, revision, marked_at, updated_at) VALUES (?, 1, ?, ?) '
      + 'AS new ON DUPLICATE KEY UPDATE revision = issues_pending_writes.revision + 1, updated_at = new.updated_at',
      [rows[0].id, now, now],
    );

    return rows[0].id;
  }

  /**
   * Whether the issue has a link, in any status. The row is locked (`FOR UPDATE`), which keeps
   * the lock order and guards against a concurrent attach.
   * @param {EntityManager} manager - The deleting transaction's manager.
   * @param {number} issueId - The issue's internal id.
   * @returns {Promise<boolean>} `true` when a link exists.
   */
  async hasLink(manager: EntityManager, issueId: number): Promise<boolean> {
    const rows: Array<{ id: number }> = await manager.query(
      'SELECT id FROM issues_github_links WHERE issue_id = ? FOR UPDATE',
      [issueId],
    );

    return rows.length > 0;
  }
}
