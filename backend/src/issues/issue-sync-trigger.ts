import { Injectable } from '@nestjs/common';

/**
 * The after-commit hook of local edits that bumped a pending marker (trigger T1,
 * `docs/agents/specs/issues/sync.md#triggers`). The service calls it only after the edit's
 * transaction resolved and only with the link ids whose marker was bumped.
 */
export abstract class IssueSyncTrigger {
  /**
   * @param {number[]} linkIds - The ids of the links whose marker was bumped (never empty).
   * @returns {void}
   */
  abstract afterCommit(linkIds: number[]): void;
}

/**
 * The default binding until #558: nothing is enqueued yet. The marker is the durable record, and
 * the boot sweep (T5) re-enqueues it. #558 swaps this binding for the real enqueue through the
 * per-link dedupe.
 */
@Injectable()
export class NoopIssueSyncTrigger extends IssueSyncTrigger {
  /**
   * @param {number[]} _linkIds - Ignored.
   * @returns {void}
   */
  afterCommit(_linkIds: number[]): void {
    // Nothing is enqueued yet (see the class comment).
  }
}
