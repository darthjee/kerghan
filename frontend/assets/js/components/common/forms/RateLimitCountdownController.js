/**
 * Counts down the seconds a rate-limited action must wait (the UI rule of
 * `ISSUE_EDIT_RATE_LIMITED`, `ISSUE_LINK_RATE_LIMITED` and `GITHUB_RATE_LIMITED`).
 *
 * @description Starts from `retryAfterSeconds`, ticks once a second, and re-enables at 0. It
 * never resubmits anything. A missing or invalid `retryAfterSeconds` is not active. The timer is
 * cleared on {@link RateLimitCountdownController#dispose}.
 */
export default class RateLimitCountdownController {
  #secondsLeft;

  #onChange;

  #timer = null;

  /**
   * Create and start the countdown.
   *
   * @param {(number|undefined)} retryAfterSeconds - The seconds to wait; anything but a positive
   *   finite number leaves the countdown inactive.
   * @param {Function} onChange - Called with the new state after every tick.
   */
  constructor(retryAfterSeconds, onChange) {
    this.#onChange = onChange;
    this.#secondsLeft = RateLimitCountdownController.#normalize(retryAfterSeconds);

    if (this.#secondsLeft > 0) {
      this.#timer = setInterval(() => this.#tick(), 1000);
    }
  }

  /**
   * The current state.
   *
   * @returns {{active: boolean, secondsLeft: number, label: (string|null)}} Whether the wait is
   *   on, the whole seconds left, and the label (`Try again in N s`, `null` when not active).
   */
  get state() {
    const active = this.#secondsLeft > 0;

    return {
      active,
      secondsLeft: this.#secondsLeft,
      label: active ? `Try again in ${this.#secondsLeft} s` : null,
    };
  }

  /**
   * Stop the timer (on unmount).
   *
   * @returns {void}
   */
  dispose() {
    this.#stop();
  }

  /**
   * Turn the raw value into whole seconds.
   *
   * @param {*} value - The raw `retryAfterSeconds`.
   * @returns {number} A whole number of seconds; 0 for anything invalid.
   */
  static #normalize(value) {
    return Number.isFinite(value) && value > 0 ? Math.ceil(value) : 0;
  }

  /** Advance one second, stopping at 0. */
  #tick() {
    this.#secondsLeft -= 1;

    if (this.#secondsLeft <= 0) {
      this.#secondsLeft = 0;
      this.#stop();
    }

    this.#onChange(this.state);
  }

  /** Clear the timer. */
  #stop() {
    if (this.#timer !== null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }
}
