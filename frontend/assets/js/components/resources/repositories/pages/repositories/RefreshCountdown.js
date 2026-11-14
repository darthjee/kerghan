/**
 * One-second ticker driving the Refresh countdown: publishes the current time while the
 * cooldown end is in the future, and stops at zero.
 */
export default class RefreshCountdown {
  #setNow;

  #timer = null;

  /**
   * Create the countdown.
   *
   * @param {Function} setNow - Called with the current epoch milliseconds on every tick.
   */
  constructor(setNow) {
    this.#setNow = setNow;
  }

  /**
   * Start ticking towards a cooldown end, replacing any running ticker. Publishes the current
   * time once, and ticks only when the end is still in the future.
   *
   * @param {number|null} until - Cooldown end, in epoch milliseconds, or `null` for none.
   * @returns {void} Nothing.
   */
  start(until) {
    this.stop();
    this.#setNow(Date.now());

    if (until === null || until <= Date.now()) {
      return;
    }

    this.#timer = setInterval(() => {
      const now = Date.now();

      this.#setNow(now);

      if (now >= until) {
        this.stop();
      }
    }, 1000);
  }

  /**
   * Stop the ticker.
   *
   * @returns {void} Nothing.
   */
  stop() {
    clearInterval(this.#timer);
    this.#timer = null;
  }
}
