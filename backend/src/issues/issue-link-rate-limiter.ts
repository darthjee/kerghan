import { Injectable } from '@nestjs/common';
import { FixedWindowRateLimiter, type RateLimitDecision } from './fixed-window-rate-limiter.js';
import { IssuesConfig } from './issues-config.js';
import { Clock } from '../core/clock.js';

/** The outcome of one link-creation attempt against the per-user window. */
export type LinkRateLimitDecision = RateLimitDecision;

/**
 * The per-user link-creation rate limit (`docs/agents/modules/issues/security.md#request-rate-limits`):
 * a `FixedWindowRateLimiter` of `linkMaxPerWindow` creations per `linkWindowMs`. Import and attach
 * share the one window; unlink is not limited. Separate from the edit limiter's window.
 */
@Injectable()
export class IssueLinkRateLimiter extends FixedWindowRateLimiter {
  /**
   * @param {Clock} clock - The time source.
   * @param {IssuesConfig} config - Supplies `linkMaxPerWindow` and `linkWindowMs`.
   */
  constructor(clock: Clock, config: IssuesConfig) {
    super(clock, config.linkMaxPerWindow, config.linkWindowMs);
  }
}
