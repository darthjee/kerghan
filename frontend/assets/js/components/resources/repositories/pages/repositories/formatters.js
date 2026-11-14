const SECOND = 1000;
const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;

/**
 * Text formatters of the Repositories page.
 */
const Formatters = {
  /**
   * Format a remaining duration as "2m 34s" (or "45s" under a minute).
   *
   * @param {number} ms - Remaining milliseconds; zero or negative reads "0s".
   * @returns {string} The countdown text, rounded up to whole seconds.
   */
  countdown(ms) {
    const total = Math.max(0, Math.ceil(ms / SECOND));
    const minutes = Math.floor(total / MINUTE);
    const seconds = total % MINUTE;

    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  },

  /**
   * Format how long ago a moment was, e.g. "5 min ago".
   *
   * @param {string|null} iso - ISO-8601 moment, or `null` when it never happened.
   * @param {number} now - Current epoch milliseconds.
   * @returns {string} "never", "just now", "N min ago", "N h ago" or "N d ago".
   */
  ago(iso, now) {
    if (!iso) {
      return 'never';
    }

    const seconds = Math.max(0, Math.floor((now - Date.parse(iso)) / SECOND));

    if (seconds < MINUTE) {
      return 'just now';
    }

    if (seconds < HOUR) {
      return `${Math.floor(seconds / MINUTE)} min ago`;
    }

    return seconds < DAY ? `${Math.floor(seconds / HOUR)} h ago` : `${Math.floor(seconds / DAY)} d ago`;
  },

  /**
   * Build the GitHub web URL of a repository. It is only ever rendered as a link, never fetched.
   *
   * @param {string} owner - The repository owner.
   * @param {string} name - The repository name.
   * @returns {string} The URL, with both segments URL-encoded.
   */
  githubUrl(owner, name) {
    return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  },
};

export default Formatters;
