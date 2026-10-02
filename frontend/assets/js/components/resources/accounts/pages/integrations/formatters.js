const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const EXPIRING_SOON_WINDOW = 7 * DAY;

const RELATIVE_UNITS = [
  [DAY, 'day'],
  [HOUR, 'hour'],
  [MINUTE, 'minute'],
];

/**
 * Display formatting for the Integrations page: dates, relative times, the expiring-soon flag
 * and the shared-login hint.
 */
const IntegrationFormatters = {
  /**
   * Format an ISO-8601 date as `YYYY-MM-DD` (UTC).
   *
   * @param {string} value - The ISO-8601 date.
   * @returns {string} The formatted date.
   */
  date(value) {
    return new Date(value).toISOString().slice(0, 10);
  },

  /**
   * Format how long ago an ISO-8601 date was (e.g. `"5 minutes ago"`, `"just now"`).
   *
   * @param {string} value - The ISO-8601 date.
   * @param {number} [now] - Current epoch milliseconds.
   * @returns {string} The relative time.
   */
  relative(value, now = Date.now()) {
    const elapsed = now - Date.parse(value);
    const unit = RELATIVE_UNITS.find(([size]) => elapsed >= size);

    if (!unit) {
      return 'just now';
    }

    const count = Math.floor(elapsed / unit[0]);

    return `${count} ${unit[1]}${count === 1 ? '' : 's'} ago`;
  },

  /**
   * Whether an integration expires within the next 7 days (and is not already `expired`).
   *
   * @param {{expiresAt: (string|null), status: string}} integration - The integration.
   * @param {number} [now] - Current epoch milliseconds.
   * @returns {boolean} `true` when the expiring-soon flag applies.
   */
  isExpiringSoon(integration, now = Date.now()) {
    if (!integration.expiresAt || integration.status === 'expired') {
      return false;
    }

    return Date.parse(integration.expiresAt) - now <= EXPIRING_SOON_WINDOW;
  },

  /**
   * GitHub logins shared by more than one of the user's integrations.
   *
   * @param {Array<{githubLogin: (string|null)}>} integrations - The integrations.
   * @returns {Set<string>} The shared logins.
   */
  sharedLogins(integrations) {
    const seen = new Set();
    const shared = new Set();

    integrations.forEach(({ githubLogin }) => {
      if (githubLogin && seen.has(githubLogin)) {
        shared.add(githubLogin);
      }
      seen.add(githubLogin);
    });

    return shared;
  },
};

export default IntegrationFormatters;
