import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type EntityManager, type Repository } from 'typeorm';
import { IssuePendingWrite } from './entities/issue-pending-write.entity.js';

/** The link statuses that keep syncing local edits (`gone` is edited locally only). */
const SYNCING_STATUSES = new Set(['linked', 'sync_failed']);

/** A pending marker as the reconcile reads it: the revision it compares and clears, and its timestamps. */
export interface MarkerState {
  revision: number;
  /** When the marker was first created (the boot order). */
  markedAt: Date;
  /** The last local edit of a synced field (`Tm` of the E7 conflict rule). */
  updatedAt: Date;
}

/**
 * The marker and link queries of the single Edit, the Delete and the sync's reconcile
 * (`docs/agents/specs/issues/sync.md#marker-lifecycle`). The write methods run inside the caller's
 * transaction, after the caller locked the issue row, and take the next locks of the order (issues,
 * links, markers).
 */
@Injectable()
export class IssueMarkers {
  /**
   * @param {Repository<IssuePendingWrite>} markers - The default-connection marker repository.
   */
  constructor(@InjectRepository(IssuePendingWrite) private readonly markers: Repository<IssuePendingWrite>) {}

  /**
   * The link ids that have a marker, oldest `marked_at` first (ties by marker id): the boot sweep
   * re-enqueues each one (T5). No filtering: the sync's guards stop a marker that cannot run.
   * @returns {Promise<number[]>} The link ids; empty when no marker exists.
   */
  async listForBoot(): Promise<number[]> {
    const rows = await this.markers.find({
      select: { id: true, linkId: true },
      order: { markedAt: 'ASC', id: 'ASC' },
    });

    return rows.map((row) => row.linkId);
  }

  /**
   * When each of the links' markers was first created, for ordering the links of a rate-limit
   * waiting set oldest first. A link without a marker has no entry.
   * @param {number[]} linkIds - The internal ids of the links.
   * @returns {Promise<Map<number, Date>>} `marked_at` by link id.
   */
  async markedAtFor(linkIds: number[]): Promise<Map<number, Date>> {
    if (linkIds.length === 0) return new Map();

    const rows = await this.markers.find({ select: { id: true, linkId: true, markedAt: true }, where: { linkId: In(linkIds) } });

    return new Map(rows.map((row) => [row.linkId, row.markedAt]));
  }

  /**
   * Reads the link's marker, or `null` when there is none. With `lock` it takes `FOR UPDATE`, the
   * fourth step of the lock order, so a concurrent edit's bump waits for the caller's commit.
   * @param {EntityManager} manager - The transaction's manager.
   * @param {number} linkId - The link's internal id.
   * @param {{ lock: boolean }} options - `lock` takes `FOR UPDATE` on the marker row.
   * @returns {Promise<MarkerState | null>} The revision and timestamps, or `null`.
   */
  async findRevision(manager: EntityManager, linkId: number, options: { lock: boolean }): Promise<MarkerState | null> {
    const row = await manager.getRepository(IssuePendingWrite).findOne({
      where: { linkId },
      ...(options.lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });

    return row === null ? null : { revision: row.revision, markedAt: row.markedAt, updatedAt: row.updatedAt };
  }

  /**
   * The compare-and-clear: deletes the link's marker only while its revision is still the one the
   * reconcile read. No row deleted means an edit bumped the revision meanwhile (or the marker is
   * already gone).
   * @param {EntityManager} manager - The reconcile's commit transaction.
   * @param {number} linkId - The link's internal id.
   * @param {number} revision - The revision the reconcile read.
   * @returns {Promise<boolean>} `true` when the marker was deleted.
   */
  async compareAndClear(manager: EntityManager, linkId: number, revision: number): Promise<boolean> {
    const result = await manager.getRepository(IssuePendingWrite).delete({ linkId, revision });

    return (result.affected ?? 0) > 0;
  }

  /**
   * Deletes the link's marker whatever its revision: the link turned `gone`, so its unsent write
   * is discarded in the same transaction (E1).
   * @param {EntityManager} manager - The `gone` transaction.
   * @param {number} linkId - The link's internal id.
   * @returns {Promise<boolean>} `true` when a marker existed.
   */
  async deleteForLink(manager: EntityManager, linkId: number): Promise<boolean> {
    const result = await manager.getRepository(IssuePendingWrite).delete({ linkId });

    return (result.affected ?? 0) > 0;
  }

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

  /**
   * Locks the link's pending marker (`FOR UPDATE`, the fourth step of the lock order) and deletes
   * it. Used by unlink, after it locked the link.
   * @param {EntityManager} manager - The unlinking transaction's manager.
   * @param {number} linkId - The link's internal id.
   * @returns {Promise<boolean>} `true` when a marker existed (unsent changes are being dropped).
   */
  async lockAndDeleteForLink(manager: EntityManager, linkId: number): Promise<boolean> {
    const rows: Array<{ id: number }> = await manager.query(
      'SELECT id FROM issues_pending_writes WHERE link_id = ? FOR UPDATE',
      [linkId],
    );

    if (rows.length === 0) {
      return false;
    }

    await manager.query('DELETE FROM issues_pending_writes WHERE link_id = ?', [linkId]);

    return true;
  }
}
