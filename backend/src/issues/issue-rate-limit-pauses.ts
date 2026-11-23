import { Injectable } from '@nestjs/common';
import { IssueMarkers } from './issue-markers.js';
import { IssueRateLimitWaits } from './issue-rate-limit-waits.js';
import { IssueReconcileQueue } from './issue-reconcile-queue.js';
import { Clock } from '../core/clock.js';
import { LoggerService } from '../core/logger.service.js';
import { Scheduler, type SchedulerHandle } from '../core/scheduler.js';

/** The pause when GitHub gave no reset time (a secondary limit): GitHub's recommended minimum. */
export const FALLBACK_PAUSE_MS = 60_000;

/** One integration's pause: when it ends, the timer that ends it and the links waiting for it. */
interface Pause {
  resetAt: Date;
  timer: SchedulerHandle;
  waiting: Set<number>;
}

/** The earliest pause among some integrations. */
export interface EarliestPause {
  integrationId: number;
  resetAt: Date;
}

/**
 * The in-memory rate-limit state of the sync (`docs/agents/modules/issues/sync.md#rate-limits`): a
 * pause per integration id holding the reset time, a waiting set of link ids per integration, and
 * one timer per integration. At the reset the timer clears the pause and enqueues one reconcile
 * per waiting link, oldest marker first (links without a marker last), through the per-link
 * dedupe. It is the real binding of the `IssueRateLimitWaits` read port the link object reads.
 *
 * Everything is keyed by integration id (never a credential), lives in this process only and is
 * lost on restart (E16): the boot sweep re-enqueues every marker, and the first call that hits the
 * limit pauses again.
 */
@Injectable()
export class IssueRateLimitPauses extends IssueRateLimitWaits {
  readonly #pauses = new Map<number, Pause>();

  /**
   * @param {Clock} clock - The time source of the pauses.
   * @param {Scheduler} scheduler - Fires the resume timers.
   * @param {IssueReconcileQueue} queue - Enqueues the waiting links at the reset, through the dedupe.
   * @param {IssueMarkers} markers - Orders the waiting links by marker age.
   * @param {LoggerService} logger - Safe-field logs (integration id, error class).
   */
  constructor(
    private readonly clock: Clock,
    private readonly scheduler: Scheduler,
    private readonly queue: IssueReconcileQueue,
    private readonly markers: IssueMarkers,
    private readonly logger: LoggerService,
  ) {
    super();
  }

  /**
   * Pauses an integration until GitHub's reset (`resetAt`), or for 60 seconds when it gave none. A
   * later answer re-arms the pause and the one timer; an answer that would shorten a pause still
   * running keeps the later reset, so a slow concurrent job never ends a pause early.
   * @param {number} integrationId - The integration that answered `rate_limited`.
   * @param {Date | null} resetAt - When the limit resets, or `null` when GitHub gave none.
   * @returns {Date} When the pause ends.
   */
  pause(integrationId: number, resetAt: Date | null): Date {
    const now = this.clock.now();
    const proposed = resetAt ?? new Date(now.getTime() + FALLBACK_PAUSE_MS);
    const running = this.#active(integrationId);
    const end = running !== undefined && running.resetAt > proposed ? running.resetAt : proposed;
    // A pause that ended but whose timer has not fired yet still holds its waiting links: they
    // carry over to the new pause, and its timer is replaced so it cannot end the new one.
    const previous = this.#pauses.get(integrationId);

    if (previous !== undefined) this.scheduler.cancel(previous.timer);

    this.#pauses.set(integrationId, {
      resetAt: end,
      waiting: previous?.waiting ?? new Set<number>(),
      timer: this.scheduler.schedule(end, () => this.#resume(integrationId)),
    });

    return end;
  }

  /**
   * @param {number} integrationId - The integration.
   * @returns {boolean} Whether a pause is running: no GitHub call is made with it until it ends.
   */
  isPaused(integrationId: number): boolean {
    return this.#active(integrationId) !== undefined;
  }

  /**
   * The paused integration whose reset comes first: where a link joins the waiting set when every
   * candidate is paused.
   * @param {number[]} integrationIds - The candidates.
   * @returns {EarliestPause | null} The earliest pause among the paused candidates, or `null` when none is paused.
   */
  earliestPause(integrationIds: number[]): EarliestPause | null {
    let earliest: EarliestPause | null = null;

    for (const integrationId of integrationIds) {
      const pause = this.#active(integrationId);

      if (pause !== undefined && (earliest === null || pause.resetAt < earliest.resetAt)) {
        earliest = { integrationId, resetAt: pause.resetAt };
      }
    }

    return earliest;
  }

  /**
   * Adds a link to an integration's waiting set (deduplicated); the timer enqueues it at the reset.
   * @param {number} integrationId - The paused integration.
   * @param {number} linkId - The link that must wait.
   * @returns {Date | null} When the wait ends, or `null` when the integration is not paused (the
   *   link is not added, so the caller must not wait).
   */
  wait(integrationId: number, linkId: number): Date | null {
    const pause = this.#active(integrationId);

    if (pause === undefined) return null;

    pause.waiting.add(linkId);

    return pause.resetAt;
  }

  /**
   * Removes a link from every waiting set: a reconcile went past guard 5 on another integration,
   * so the link no longer waits and must not show as rate limited.
   * @param {number} linkId - The link.
   * @returns {void}
   */
  release(linkId: number): void {
    for (const pause of this.#pauses.values()) pause.waiting.delete(linkId);
  }

  /**
   * @param {number[]} linkIds - The internal ids of the links being presented.
   * @returns {Map<number, Date>} For each link in a waiting set, the reset time of the pause it waits
   *   on (the earliest, when it waits on several); a link not waiting has no entry.
   */
  untilFor(linkIds: number[]): Map<number, Date> {
    const until = new Map<number, Date>();

    for (const integrationId of this.#pauses.keys()) {
      const pause = this.#active(integrationId);

      if (pause === undefined) continue;

      for (const linkId of linkIds) {
        const known = until.get(linkId);

        if (pause.waiting.has(linkId) && (known === undefined || pause.resetAt < known)) until.set(linkId, pause.resetAt);
      }
    }

    return until;
  }

  /**
   * @param {number} integrationId - The integration.
   * @returns {Pause | undefined} Its pause while it has not ended.
   */
  #active(integrationId: number): Pause | undefined {
    const pause = this.#pauses.get(integrationId);

    return pause !== undefined && pause.resetAt > this.clock.now() ? pause : undefined;
  }

  /**
   * The timer's callback: clears the pause and enqueues the waiting links.
   * @param {number} integrationId - The integration whose pause ended.
   * @returns {void}
   */
  #resume(integrationId: number): void {
    const pause = this.#pauses.get(integrationId);

    if (pause === undefined) return;

    this.#pauses.delete(integrationId);
    this.#enqueueOldestFirst([...pause.waiting]).catch(() => undefined);
  }

  /**
   * Enqueues the links, oldest marker first and the links without a marker last. When the marker
   * ages cannot be read, the links are enqueued in the order they joined (the marker order is a
   * preference, not a rule): a rate limit never loses a waiting link.
   * @param {number[]} linkIds - The waiting links, in join order.
   * @returns {Promise<void>} Resolves once every link was enqueued.
   */
  async #enqueueOldestFirst(linkIds: number[]): Promise<void> {
    let ordered = linkIds;

    try {
      const markedAt = await this.markers.markedAtFor(linkIds);

      ordered = [...linkIds].sort((a, b) => (markedAt.get(a)?.getTime() ?? Infinity) - (markedAt.get(b)?.getTime() ?? Infinity));
    } catch (error) {
      this.logger.error('issues rate limit resume could not order links', {
        context: 'IssueRateLimitPauses',
        errorClass: error instanceof Error ? error.constructor.name : typeof error,
      });
    }

    for (const linkId of ordered) this.queue.enqueue(linkId);
  }
}
