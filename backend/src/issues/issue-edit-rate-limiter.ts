import { Injectable } from '@nestjs/common';
import { IssuesConfig } from './issues-config.js';
import { Clock } from '../core/clock.js';

/** The outcome of one edit attempt against the per-user window. */
export type EditRateLimitDecision = { allowed: true } | { allowed: false; retryAfterMs: number };

/** One user's current fixed window. */
interface EditWindow {
  windowStart: number;
  count: number;
}

/**
 * The per-user issue-edit rate limit (`docs/agents/specs/issues/security.md#request-rate-limits`):
 * an in-memory, per-process fixed window of `editMaxPerWindow` edits per `editWindowMs`. It has
 * no table: it resets on restart and each instance counts on its own. Time comes from the
 * injected `Clock`. Expired windows are swept at most once per window, so the map cannot grow
 * without bound.
 *
 * Two callers share it: the single edit (#556) consumes weight 1, and bulk state (#563) consumes
 * `issueIds.length`. The call is all-or-nothing: when `used + weight > max` it is refused and
 * nothing is consumed (E74), so a lighter call can still pass afterwards. Not shared with the
 * link limiter (#557), which has its own window.
 */
@Injectable()
export class IssueEditRateLimiter {
  readonly #clock: Clock;
  readonly #max: number;
  readonly #windowMs: number;
  readonly #windows = new Map<number, EditWindow>();
  #lastSweep = Number.NEGATIVE_INFINITY;

  /**
   * @param {Clock} clock - The time source.
   * @param {IssuesConfig} config - Supplies `editMaxPerWindow` and `editWindowMs`.
   */
  constructor(clock: Clock, config: IssuesConfig) {
    this.#clock = clock;
    this.#max = config.editMaxPerWindow;
    this.#windowMs = config.editWindowMs;
  }

  /**
   * Counts `weight` edits for the user, or refuses the whole call and consumes nothing.
   * @param {number} userId - The caller.
   * @param {number} [weight] - How many edits the call counts for (default 1).
   * @returns {EditRateLimitDecision} Allowed, or refused with the delay until the window ends.
   */
  consume(userId: number, weight: number = 1): EditRateLimitDecision {
    const now = this.#clock.now().getTime();

    this.#sweep(now);

    const window = this.#windows.get(userId);

    if (window === undefined || now - window.windowStart >= this.#windowMs) {
      return this.#startWindow(userId, now, weight);
    }

    if (window.count + weight > this.#max) {
      return { allowed: false, retryAfterMs: window.windowStart + this.#windowMs - now };
    }

    window.count += weight;
    return { allowed: true };
  }

  /**
   * The number of users currently tracked (for the bounded-memory check).
   * @returns {number} The map size.
   */
  trackedUsers(): number {
    return this.#windows.size;
  }

  /**
   * Opens a fresh window at `weight`; a weight above the maximum is refused and opens nothing.
   * @param {number} userId - The caller.
   * @param {number} now - The current instant, in ms.
   * @param {number} weight - The edits the call counts for.
   * @returns {EditRateLimitDecision} The decision.
   */
  #startWindow(userId: number, now: number, weight: number): EditRateLimitDecision {
    if (weight > this.#max) {
      this.#windows.delete(userId);
      return { allowed: false, retryAfterMs: this.#windowMs };
    }

    this.#windows.set(userId, { windowStart: now, count: weight });
    return { allowed: true };
  }

  /**
   * Drops every expired window, at most once per window length.
   * @param {number} now - The current instant, in ms.
   * @returns {void}
   */
  #sweep(now: number): void {
    if (now - this.#lastSweep < this.#windowMs) {
      return;
    }

    this.#lastSweep = now;

    for (const [userId, window] of this.#windows) {
      if (now - window.windowStart >= this.#windowMs) {
        this.#windows.delete(userId);
      }
    }
  }
}
