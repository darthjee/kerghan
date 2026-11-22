/**
 * The read port of the per-integration rate-limit waiting sets
 * (`docs/agents/specs/issues/sync.md`): for the links that are waiting on a rate limit, when the
 * wait ends. The link object reads it to show `rate_limited` and `rateLimitedUntil`. The waiting
 * sets are in memory, so they disappear on restart.
 *
 * #557 binds `EmptyIssueRateLimitWaits`, because nothing pauses a link yet. #558 binds the real
 * in-memory waiting sets in its place; no call site changes.
 */
export abstract class IssueRateLimitWaits {
  /**
   * @param {number[]} linkIds - The internal ids of the links being presented.
   * @returns {Map<number, Date>} The reset time of each link that is in a waiting set; a link not
   *   waiting has no entry.
   */
  abstract untilFor(linkIds: number[]): Map<number, Date>;
}

/** The default binding: no link is ever waiting (#558 replaces it with the real waiting sets). */
export class EmptyIssueRateLimitWaits extends IssueRateLimitWaits {
  /**
   * @param {number[]} _linkIds - The internal ids of the links being presented.
   * @returns {Map<number, Date>} An empty map.
   */
  untilFor(_linkIds: number[]): Map<number, Date> {
    return new Map();
  }
}
