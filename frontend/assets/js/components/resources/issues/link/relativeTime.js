import Formatters from '../../repositories/pages/repositories/formatters.js';

const MINUTE_MS = 60000;

/**
 * Relative-time helpers of the link panel.
 */
const RelativeTime = {
  /**
   * How long ago a moment was, e.g. "5 min ago" (the Repositories page's wording).
   *
   * @param {string|null} from - ISO-8601 moment.
   * @param {number} now - Current epoch milliseconds.
   * @returns {string} "just now", "N min ago", "N h ago" or "N d ago".
   */
  ago(from, now) {
    return Formatters.ago(from, now);
  },

  /**
   * Whole minutes until a moment, at least one.
   *
   * @param {number} until - The moment, in epoch milliseconds.
   * @param {number} now - Current epoch milliseconds.
   * @returns {number} The minutes, rounded up.
   */
  minutesUntil(until, now) {
    return Math.max(1, Math.ceil((until - now) / MINUTE_MS));
  },

  /**
   * The local clock time of a moment, as HH:MM.
   *
   * @param {number} moment - The moment, in epoch milliseconds.
   * @returns {string} The time in the browser's time zone.
   */
  clock(moment) {
    const date = new Date(moment);
    const pad = (value) => String(value).padStart(2, '0');

    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },
};

export default RelativeTime;
