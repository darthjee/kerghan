import { Job, type JobLogger, type JobParams } from 'deku-swarm';
import type { IssueSyncQueue } from '../issue-sync-queue.js';
import type { IssuesConfig } from '../issues-config.js';
import type { IssuesSyncService, ReconcileOutcome } from '../issues-sync.service.js';

/** The name the job is registered and enqueued under. */
export const ISSUES_RECONCILE_JOB = 'issues.reconcile';

/** What the Issues module injects into every built job (never a credential, never params). */
export interface ReconcileJobAttributes {
  sync: IssuesSyncService;
  queue: IssueSyncQueue;
  config: IssuesConfig;
}

/**
 * The one sync job (`docs/agents/modules/issues/sync.md#job`): it reconciles one link. Its params
 * are `{ linkId }` only; the sync service, the queue and the config arrive as injected
 * attributes. It is thin: `perform()` runs `reconcile` and maps its outcome.
 *
 * The retry values are the job's own getters, read from `IssuesConfig` (5 retries, a 30 s
 * cooldown), independent of the engine-wide `KERGHAN_WORKERS_*` values. Exhaustion is detected by
 * a private attempt counter incremented at the start of each `perform()` (the engine reuses the
 * same instance across retries): the last attempt tells the service, which then sets
 * `sync_failed` with `retries_exhausted` instead of asking for a retry. Logs carry the link id,
 * the outcome kind and the error class only, and the thrown errors carry a fixed message, because
 * the worker logs it.
 */
export class IssuesReconcileJob extends Job {
  readonly #attributes: ReconcileJobAttributes;
  readonly #linkId: number | null;
  #attempts = 0;

  /**
   * @param {JobParams} params - `{ linkId }` plus the injected attributes.
   */
  constructor(params: JobParams = {}) {
    super(params);
    this.#attributes = { sync: params.sync, queue: params.queue, config: params.config } as ReconcileJobAttributes;
    this.#linkId = Number.isInteger(params.linkId) ? params.linkId as number : null;
  }

  /**
   * @returns {number} The retry limit, from `KERGHAN_ISSUES_SYNC_MAX_RETRIES`.
   */
  get maxRetries(): number {
    return this.#attributes.config.syncMaxRetries;
  }

  /**
   * @returns {number} The fixed cooldown between retries in milliseconds, from `KERGHAN_ISSUES_SYNC_COOLDOWN_MS`.
   */
  get cooldown(): number {
    return this.#attributes.config.syncCooldownMs;
  }

  /**
   * Reconciles the link and maps the outcome: `done`, `stopped` and `rate_limited` finish
   * cleanly (a rate limit never consumes an attempt), `requeue` enqueues a fresh job first, and
   * `transient` fails so the engine retries after the cooldown.
   * @param {JobLogger} [logger] - The worker's logger (carries the job id).
   * @returns {Promise<void>} Resolves when the job finished cleanly.
   * @throws {Error} A fixed-message error, only for a transient failure or an unexpected one.
   */
  async perform(logger?: JobLogger): Promise<void> {
    this.#attempts += 1;

    if (this.#linkId === null) {
      logger?.warn('issues reconcile skipped: no link id');
      return;
    }

    // The link leaves the queued set when its job starts, so an edit during this run enqueues the next one.
    this.#attributes.queue.started(this.#linkId);

    const outcome = await this.#run(this.#linkId, logger);

    logger?.info(`issues reconcile link=${this.#linkId} outcome=${outcome.kind}`);

    if (outcome.kind === 'requeue') this.#attributes.queue.enqueue(this.#linkId);
    if (outcome.kind === 'transient') this._fail(new Error('issues reconcile transient failure'));
  }

  /**
   * @param {number} linkId - The link.
   * @param {JobLogger} [logger] - The worker's logger.
   * @returns {Promise<ReconcileOutcome>} The service's outcome; an unexpected error fails the attempt.
   */
  async #run(linkId: number, logger?: JobLogger): Promise<ReconcileOutcome> {
    try {
      return await this.#attributes.sync.reconcile(linkId, { lastAttempt: this.#attempts >= this.maxRetries });
    } catch (error) {
      logger?.error(`issues reconcile link=${linkId} failed: ${error instanceof Error ? error.constructor.name : typeof error}`);

      return this._fail(new Error('issues reconcile failed'));
    }
  }
}
