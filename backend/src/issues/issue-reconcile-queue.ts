/**
 * The port that enqueues one reconcile of a link (`docs/agents/specs/issues/sync.md#triggers`),
 * through the mandatory per-link dedupe. Every trigger and the rate-limit timers go through it,
 * so the in-memory queue holds at most one waiting job per link. Never blocks and never throws.
 */
export abstract class IssueReconcileQueue {
  /**
   * @param {number} linkId - The internal id of the link to reconcile.
   * @returns {void}
   */
  abstract enqueue(linkId: number): void;
}
