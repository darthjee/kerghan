import { Injectable } from '@nestjs/common';
import { IssueReconcileQueue } from './issue-reconcile-queue.js';
import { ISSUES_RECONCILE_JOB } from './jobs/issues-reconcile.job.js';
import { LoggerService } from '../core/logger.service.js';
import { WorkersService } from '../workers/workers.service.js';

/**
 * The mandatory per-link dedupe (`docs/agents/specs/issues/sync.md#queued-jobs-are-deduplicated-per-link`)
 * in front of `WorkersService`: while a reconcile for a link is queued and not yet started,
 * enqueuing the same link again is a no-op. The link leaves the queued set when its job starts
 * (`started`), so an edit during a running job still enqueues the next one. Every trigger (T1 to
 * T6) and the rate-limit timers go through it, so the in-memory queue holds at most one waiting
 * job per link. It is per process and lost on restart; correctness never depends on it (E13).
 *
 * The job's params are `{ linkId }` only: an id, never content or a credential.
 */
@Injectable()
export class IssueSyncQueue extends IssueReconcileQueue {
  readonly #queued = new Set<number>();

  /**
   * @param {WorkersService} workers - The in-process job queue.
   * @param {LoggerService} logger - Safe-field logs (the link id and the error class).
   */
  constructor(
    private readonly workers: WorkersService,
    private readonly logger: LoggerService,
  ) {
    super();
  }

  /**
   * Enqueues one reconcile of the link unless one is already waiting. A failure of the queue is
   * logged (the marker is the durable record, the boot sweep recovers it) and never thrown.
   * @param {number} linkId - The internal id of the link to reconcile.
   * @returns {void}
   */
  enqueue(linkId: number): void {
    if (this.#queued.has(linkId)) return;

    this.#queued.add(linkId);

    try {
      this.workers.enqueue(ISSUES_RECONCILE_JOB, { linkId });
    } catch (error) {
      this.#queued.delete(linkId);
      this.logger.error('issues reconcile enqueue failed', {
        context: 'IssueSyncQueue',
        linkId,
        errorClass: error instanceof Error ? error.constructor.name : typeof error,
      });
    }
  }

  /**
   * The link's job started: it is no longer waiting, so the next enqueue adds a new job.
   * @param {number} linkId - The internal id of the link.
   * @returns {void}
   */
  started(linkId: number): void {
    this.#queued.delete(linkId);
  }

  /**
   * @param {number} linkId - The internal id of the link.
   * @returns {boolean} Whether a reconcile of the link is waiting to start.
   */
  isQueued(linkId: number): boolean {
    return this.#queued.has(linkId);
  }
}
