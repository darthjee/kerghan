import { Injectable } from '@nestjs/common';
import { IssueReconcileQueue } from './issue-reconcile-queue.js';
import { IssueSyncTrigger } from './issue-sync-trigger.js';

/**
 * Trigger T1 (`docs/agents/specs/issues/sync.md#triggers`): the after-commit hook of a local
 * edit enqueues one reconcile per link whose marker was bumped, through the per-link dedupe. The
 * issues service calls it only after the edit's transaction resolved, so the job never reads
 * uncommitted rows; a crash between the commit and the enqueue is covered by the boot sweep (T5).
 */
@Injectable()
export class EnqueueIssueSyncTrigger extends IssueSyncTrigger {
  /**
   * @param {IssueReconcileQueue} queue - The deduplicating queue.
   */
  constructor(private readonly queue: IssueReconcileQueue) {
    super();
  }

  /**
   * @param {number[]} linkIds - The ids of the links whose marker was bumped.
   * @returns {void}
   */
  afterCommit(linkIds: number[]): void {
    for (const linkId of linkIds) this.queue.enqueue(linkId);
  }
}
