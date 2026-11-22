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
 * A binding that enqueues nothing: the marker is the durable record, and the boot sweep (T5)
 * re-enqueues it. `EnqueueIssueSyncTrigger` is the real binding (T1); this one stays for specs
 * that need an inert port.
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
