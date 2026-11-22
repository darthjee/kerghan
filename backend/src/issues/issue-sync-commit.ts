import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type { IssueValues } from './github-values.js';
import { IssueLinkStore } from './issue-link-store.js';
import { IssueMarkers } from './issue-markers.js';
import { IssueStore } from './issue-store.js';
import type { SyncSubject } from './issue-sync-reader.js';
import { stampOf } from './timestamps.js';
import { Clock } from '../core/clock.js';

/** What a reconcile learned from GitHub and wants to commit. */
export interface CommitPlan {
  /** What the base takes whatever happens: the pushed fields, and the fields both sides agree on (E8). */
  baseValues: Partial<IssueValues>;
  /** GitHub's values for the pulled fields; written to the issue and the base only while the marker revision is unchanged. */
  pulled: Partial<IssueValues>;
  /** Whether a `PATCH` was sent (it nulls the stored `ETag`). */
  pushed: boolean;
  /** The `PATCH` response's `updated_at`, else the `GET`'s (the stored one after a `304`). */
  githubUpdatedAt: Date | null;
  /** The `ETag` of the `200` `GET` (the stored one after a `304`): kept only when it stays valid. */
  etag: string | null;
}

/** How a commit ended: `requeue` when the marker was bumped meanwhile (T6). */
export type CommitResult = 'done' | 'requeue';

/**
 * The reconcile's commit (`docs/agents/specs/issues/sync.md#reconcile`, steps 5 and 6): one
 * transaction in lock order (issue, link, marker) that applies the push effects, the pulled
 * fields only while the marker revision is still the one the job read, and the compare-and-clear.
 * It writes nothing when the issue or the link is gone (E1, E32, E44) and never inserts.
 */
@Injectable()
export class IssueSyncCommit {
  /**
   * @param {DataSource} dataSource - Opens the transaction.
   * @param {IssueStore} issues - Locks and updates the issue.
   * @param {IssueLinkStore} links - Locks the link and writes the sync effects.
   * @param {IssueMarkers} markers - Locks the marker and compare-and-clears it.
   * @param {Clock} clock - The time source of the timestamps.
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly issues: IssueStore,
    private readonly links: IssueLinkStore,
    private readonly markers: IssueMarkers,
    private readonly clock: Clock,
  ) {}

  /**
   * Commits one reconcile.
   * @param {SyncSubject} subject - What the job read at the start (revision `R`).
   * @param {CommitPlan} plan - What GitHub answered and the merge decided.
   * @returns {Promise<CommitResult>} `requeue` when an edit bumped the marker meanwhile and it still
   *   exists; `done` otherwise, including when the issue or link no longer exists.
   */
  apply(subject: SyncSubject, plan: CommitPlan): Promise<CommitResult> {
    return this.dataSource.transaction(async (manager) => {
      if (await this.issues.lockById(manager, subject.issueId) === null) return 'done';
      if (await this.links.lockForCommit(manager, subject.linkId) === null) return 'done';

      const read = subject.marker?.revision ?? null;
      const current = await this.#currentRevision(manager, subject.linkId);
      // Unchanged: still the revision the job read (or still no marker). Any edit bumps it.
      const unchanged = current === read;
      const cleared = await this.#clear(manager, subject.linkId, unchanged ? read : null);

      await this.#write(manager, subject, plan, unchanged, unchanged && (read === null || cleared));

      return !unchanged && current !== null ? 'requeue' : 'done';
    });
  }

  /**
   * Locks the marker (the last step of the lock order) and reads its revision.
   * @param {EntityManager} manager - The commit transaction's manager.
   * @param {number} linkId - The link.
   * @returns {Promise<number | null>} The revision, or `null` when there is no marker.
   */
  async #currentRevision(manager: EntityManager, linkId: number): Promise<number | null> {
    return (await this.markers.findRevision(manager, linkId, { lock: true }))?.revision ?? null;
  }

  /**
   * The compare-and-clear, skipped when there is nothing to clear.
   * @param {EntityManager} manager - The commit transaction's manager.
   * @param {number} linkId - The link.
   * @param {number | null} revision - The revision to clear, or `null` for none.
   * @returns {Promise<boolean>} `true` when a marker was deleted.
   */
  async #clear(manager: EntityManager, linkId: number, revision: number | null): Promise<boolean> {
    return revision !== null && await this.markers.compareAndClear(manager, linkId, revision);
  }

  /**
   * Writes the pulled fields (only while unchanged) and the link's sync effects.
   * @param {EntityManager} manager - The commit transaction's manager.
   * @param {SyncSubject} subject - What the job read.
   * @param {CommitPlan} plan - What to commit.
   * @param {boolean} unchanged - Whether the marker revision is still the one the job read.
   * @param {boolean} clearFailure - Whether the link leaves `sync_failed`.
   * @returns {Promise<void>}
   */
  async #write(manager: EntityManager, subject: SyncSubject, plan: CommitPlan, unchanged: boolean, clearFailure: boolean): Promise<void> {
    const pulled = unchanged ? plan.pulled : {};

    if (Object.keys(pulled).length > 0) await this.issues.update(manager, subject.issueId, pulled, this.clock.now());

    await this.links.recordSync(manager, subject.linkId, {
      base: { ...plan.baseValues, ...pulled },
      githubUpdatedAt: plan.githubUpdatedAt,
      etag: keepsEtag(plan, unchanged) ? plan.etag : null,
      // A failure belongs to an unsent write: only a cleared marker, or no marker at all, leaves it.
      clearFailure,
      now: stampOf(this.clock),
    });
  }
}

/**
 * Whether the `GET`'s `ETag` may be stored. A push nulls it (the read after a push is a full
 * `GET`); so does a skipped pull, because the next `GET` must see the pulled change again instead
 * of answering `304`.
 * @param {CommitPlan} plan - What the reconcile wants to commit.
 * @param {boolean} unchanged - Whether the marker revision is still the one the job read.
 * @returns {boolean} `true` when the etag stays valid.
 */
function keepsEtag(plan: CommitPlan, unchanged: boolean): boolean {
  return !plan.pushed && (unchanged || Object.keys(plan.pulled).length === 0);
}
