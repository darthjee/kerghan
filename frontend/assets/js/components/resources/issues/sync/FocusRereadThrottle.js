/** The least time between two focus re-reads (P4). */
export const FOCUS_THROTTLE_MS = 30000;

/**
 * Re-reads on window focus, at most once every 30 s, on an injected clock.
 */
export default class FocusRereadThrottle {
  /**
   * Create a throttle.
   *
   * @param {object} options - The collaborators.
   * @param {Function} options.reread - Called on a focus that is not throttled.
   * @param {Function} [options.now] - The clock, in milliseconds.
   * @param {number} [options.intervalMs] - The throttle window.
   */
  constructor({ reread, now = () => Date.now(), intervalMs = FOCUS_THROTTLE_MS }) {
    this.reread = reread;
    this.now = now;
    this.intervalMs = intervalMs;
    this.lastAt = null;
    this.listener = null;
    this.target = null;
  }

  /**
   * Handle a window focus.
   *
   * @returns {boolean} `true` when the re-read ran, `false` when throttled.
   */
  handleFocus() {
    const current = this.now();

    if (this.lastAt !== null && current - this.lastAt < this.intervalMs) {
      return false;
    }

    this.lastAt = current;
    this.reread();

    return true;
  }

  /**
   * Listen to the `focus` event of a window.
   *
   * @param {EventTarget} target - The window.
   * @returns {void} Nothing.
   */
  attach(target) {
    this.dispose();
    this.target = target;
    this.listener = () => this.handleFocus();
    target.addEventListener('focus', this.listener);
  }

  /**
   * Stop listening.
   *
   * @returns {void} Nothing.
   */
  dispose() {
    this.target?.removeEventListener('focus', this.listener);
    this.target = null;
    this.listener = null;
  }
}
