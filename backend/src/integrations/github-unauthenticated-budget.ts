import { Injectable } from '@nestjs/common';
import type { RateLimitFields } from './github-repo-results.js';
import { Clock } from '../core/clock.js';

/** Who spends an unauthenticated call: the sync's handle listing, or Add's re-check. */
export type UnauthenticatedPurpose = 'sync' | 'add';

/** A granted call, or a refusal with the window's reset. */
export type BudgetAcquire = { ok: true } | { ok: false; resetAt: Date };

/**
 * Remaining calls at or below which a purpose is refused: the sync keeps a
 * reserve of 10 for Add's re-checks, which stop only at 0.
 */
export const UNAUTHENTICATED_THRESHOLDS: Readonly<Record<UnauthenticatedPurpose, number>> = {
  sync: 10,
  add: 0,
};

/**
 * The process-wide unauthenticated GitHub budget (see
 * `docs/agents/modules/integrations/github-service.md#unauthenticated-budget-tracker`).
 * An internal singleton of the Integrations module, never exported:
 * `IntegrationsGithubService` consults it before every unauthenticated call.
 *
 * - It tracks the minimum `X-RateLimit-Remaining` within one reset window; a
 *   later `X-RateLimit-Reset` starts a new window, an older one is ignored.
 * - A granted call reserves one unit (decrements the tracked remaining), so
 *   concurrent calls never overshoot it.
 * - With no data, or once the window's reset has passed (read from the
 *   injected `Clock`), calls are allowed until the next response.
 */
@Injectable()
export class GithubUnauthenticatedBudget {
  #remaining: number | null = null;
  #resetAt: Date | null = null;

  /**
   * @param {Clock} clock - The time source, for "reset passed".
   */
  constructor(private readonly clock: Clock) {}

  /**
   * Grants (and reserves) one unauthenticated call, or refuses it under the purpose's threshold.
   * @param {UnauthenticatedPurpose} purpose - `sync` (refused at ≤ 10) or `add` (refused at ≤ 0).
   * @returns {BudgetAcquire} The grant, or the refusal with the window's reset.
   */
  tryAcquire(purpose: UnauthenticatedPurpose): BudgetAcquire {
    if (this.#remaining === null || this.#resetAt === null || this.clock.now() >= this.#resetAt) {
      return { ok: true };
    }

    if (this.#remaining <= UNAUTHENTICATED_THRESHOLDS[purpose]) {
      return { ok: false, resetAt: new Date(this.#resetAt.getTime()) };
    }

    this.#remaining -= 1;

    return { ok: true };
  }

  /**
   * Records the rate-limit headers of an unauthenticated answer (`304` included).
   * @param {RateLimitFields} rateLimit - The answer's normalised headers.
   * @returns {void}
   */
  record(rateLimit: RateLimitFields): void {
    const { rateLimitRemaining: remaining, rateLimitReset: reset } = rateLimit;

    if (remaining === null || reset === null) {
      return;
    }

    const resetAt = new Date(reset * 1000);

    if (this.#remaining === null || this.#resetAt === null || resetAt > this.#resetAt) {
      this.#remaining = remaining;
      this.#resetAt = resetAt;
    } else if (resetAt.getTime() === this.#resetAt.getTime()) {
      this.#remaining = Math.min(this.#remaining, remaining);
    }
  }
}
