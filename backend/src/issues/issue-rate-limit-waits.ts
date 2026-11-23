/**
 * The read port of the per-integration rate-limit waiting sets
 * (`docs/agents/modules/issues/sync.md`): for the links that are waiting on a rate limit, when the
 * wait ends. The link object reads it to show `rate_limited` and `rateLimitedUntil`. The waiting
 * sets are in memory, so they disappear on restart.
 *
 * `IssueRateLimitPauses` is the binding: the in-memory waiting sets of the sync.
 */
export abstract class IssueRateLimitWaits {
  /**
   * @param {number[]} linkIds - The internal ids of the links being presented.
   * @returns {Map<number, Date>} The reset time of each link that is in a waiting set; a link not
   *   waiting has no entry.
   */
  abstract untilFor(linkIds: number[]): Map<number, Date>;
}
