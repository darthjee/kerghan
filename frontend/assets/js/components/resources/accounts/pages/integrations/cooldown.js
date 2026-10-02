/**
 * Parse an ISO-8601 date into epoch milliseconds.
 *
 * @param {string|null} value - The ISO-8601 date, or `null`.
 * @returns {number|null} The epoch milliseconds, or `null` when absent or unparseable.
 */
function parseDate(value) {
  if (!value) {
    return null;
  }

  const time = Date.parse(value);

  return Number.isNaN(time) ? null : time;
}

/**
 * Test-connection cooldown rules: *Test* is disabled until the integration's `nextTestAt`, and,
 * after a `429`, until the row's `cooldownUntil` (`now + Retry-After`).
 */
const Cooldown = {
  /**
   * When the cooldown of an integration ends.
   *
   * @param {{nextTestAt: (string|null)}} integration - The integration.
   * @param {{cooldownUntil: (number|null)}} [row] - The row's UI state.
   * @returns {number|null} The latest end of the cooldowns, in epoch milliseconds, or `null`
   *   when there is none.
   */
  endsAt(integration, row = {}) {
    const ends = [parseDate(integration.nextTestAt), row.cooldownUntil ?? null]
      .filter((value) => value !== null);

    return ends.length === 0 ? null : Math.max(...ends);
  },

  /**
   * Whether *Test* is currently disabled for an integration.
   *
   * @param {{nextTestAt: (string|null)}} integration - The integration.
   * @param {{cooldownUntil: (number|null)}} [row] - The row's UI state.
   * @param {number} [now] - Current epoch milliseconds.
   * @returns {boolean} `true` while a cooldown is still running.
   */
  isActive(integration, row = {}, now = Date.now()) {
    const endsAt = Cooldown.endsAt(integration, row);

    return endsAt !== null && endsAt > now;
  },
};

export default Cooldown;
