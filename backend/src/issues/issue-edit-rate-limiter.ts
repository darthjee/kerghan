import { Injectable } from '@nestjs/common';
import { FixedWindowRateLimiter, type RateLimitDecision } from './fixed-window-rate-limiter.js';
import { IssuesConfig } from './issues-config.js';
import { Clock } from '../core/clock.js';

/** The outcome of one edit attempt against the per-user window. */
export type EditRateLimitDecision = RateLimitDecision;

/**
 * The per-user issue-edit rate limit (`docs/agents/specs/issues/security.md#request-rate-limits`):
 * a `FixedWindowRateLimiter` of `editMaxPerWindow` edits per `editWindowMs`.
 *
 * Two callers share it: the single edit (#556) consumes weight 1, and bulk state (#563) consumes
 * `issueIds.length`. The call is all-or-nothing: when `used + weight > max` it is refused and
 * nothing is consumed (E74), so a lighter call can still pass afterwards. Not shared with the
 * link limiter (#557), which has its own window.
 */
@Injectable()
export class IssueEditRateLimiter extends FixedWindowRateLimiter {
  /**
   * @param {Clock} clock - The time source.
   * @param {IssuesConfig} config - Supplies `editMaxPerWindow` and `editWindowMs`.
   */
  constructor(clock: Clock, config: IssuesConfig) {
    super(clock, config.editMaxPerWindow, config.editWindowMs);
  }
}
