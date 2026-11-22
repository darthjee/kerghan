/** Milliseconds between two ticks (relative times stay current to the minute). */
export const TICK_MS = 30000;

/**
 * Ticker that re-renders the link panel every 30 s, so its relative times stay current.
 */
export default class LinkClockTicker {
  #setNow;

  #timer = null;

  /**
   * Create the ticker.
   *
   * @param {Function} setNow - Called with the current epoch milliseconds on every tick.
   */
  constructor(setNow) {
    this.#setNow = setNow;
  }

  /**
   * Publish the current time and tick every 30 s, replacing any running ticker.
   *
   * @returns {void} Nothing.
   */
  start() {
    this.stop();
    this.#setNow(Date.now());
    this.#timer = setInterval(() => this.#setNow(Date.now()), TICK_MS);
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
