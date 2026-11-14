import { Injectable } from '@nestjs/common';
import { RepositoriesConfig } from './repositories-config.js';
import { Clock } from '../core/clock.js';

/** The outcome of one Add attempt against the per-user window. */
export type AddRateLimitDecision = { allowed: true } | { allowed: false; retryAfterMs: number };

/** One user's current fixed window. */
interface AddWindow {
  windowStart: number;
  count: number;
}

/**
 * The per-user Add rate limit (`docs/agents/backend/routes/repositories.md#add-rate-limit`): an in-memory,
 * per-process fixed window of `addMaxPerWindow` Adds per `addWindowMs`.
 * It has no table: it resets on restart and each instance counts on its own.
 * Time comes from the injected `Clock`. Expired windows are swept at most
 * once per window, so the map cannot grow without bound.
 */
@Injectable()
export class RepositoryAddRateLimiter {
  readonly #clock: Clock;
  readonly #max: number;
  readonly #windowMs: number;
  readonly #windows = new Map<number, AddWindow>();
  #lastSweep = Number.NEGATIVE_INFINITY;

  /**
   * @param {Clock} clock - The time source.
   * @param {RepositoriesConfig} config - Supplies `addMaxPerWindow` and `addWindowMs`.
   */
  constructor(clock: Clock, config: RepositoriesConfig) {
    this.#clock = clock;
    this.#max = config.addMaxPerWindow;
    this.#windowMs = config.addWindowMs;
  }

  /**
   * Counts one Add attempt for the user, whatever its later outcome.
   * @param {number} userId - The caller.
   * @returns {AddRateLimitDecision} Allowed, or refused with the delay until the window ends.
   */
  consume(userId: number): AddRateLimitDecision {
    const now = this.#clock.now().getTime();

    this.#sweep(now);

    const window = this.#windows.get(userId);

    if (window === undefined || now - window.windowStart >= this.#windowMs) {
      this.#windows.set(userId, { windowStart: now, count: 1 });
      return { allowed: true };
    }

    if (window.count < this.#max) {
      window.count += 1;
      return { allowed: true };
    }

    return { allowed: false, retryAfterMs: window.windowStart + this.#windowMs - now };
  }

  /**
   * The number of users currently tracked (for the bounded-memory check).
   * @returns {number} The map size.
   */
  trackedUsers(): number {
    return this.#windows.size;
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
