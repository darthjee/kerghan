import type { Clock } from '../core/clock.js';

/** The outcome of one attempt against a per-user window. */
export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterMs: number };

/** One user's current fixed window. */
interface Window {
  windowStart: number;
  count: number;
}

/**
 * The window bookkeeping shared by the Issues per-user rate limits: an in-memory, per-process
 * fixed window of `max` units per `windowMs`. It has no table: it resets on restart and each
 * instance counts on its own. Time comes from the `Clock`. Expired windows are swept at most once
 * per window, so the map cannot grow without bound.
 *
 * A call counts for a `weight` and is all-or-nothing: when `used + weight > max` it is refused and
 * nothing is consumed, so a lighter call can still pass afterwards.
 */
export class FixedWindowRateLimiter {
  readonly #clock: Clock;
  readonly #max: number;
  readonly #windowMs: number;
  readonly #windows = new Map<number, Window>();
  #lastSweep = Number.NEGATIVE_INFINITY;

  /**
   * @param {Clock} clock - The time source.
   * @param {number} max - The units allowed per window.
   * @param {number} windowMs - The window length, in ms.
   */
  constructor(clock: Clock, max: number, windowMs: number) {
    this.#clock = clock;
    this.#max = max;
    this.#windowMs = windowMs;
  }

  /**
   * Counts `weight` units for the user, or refuses the whole call and consumes nothing.
   * @param {number} userId - The caller.
   * @param {number} [weight] - How many units the call counts for (default 1).
   * @returns {RateLimitDecision} Allowed, or refused with the delay until the window ends.
   */
  consume(userId: number, weight: number = 1): RateLimitDecision {
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
   * @param {number} weight - The units the call counts for.
   * @returns {RateLimitDecision} The decision.
   */
  #startWindow(userId: number, now: number, weight: number): RateLimitDecision {
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
