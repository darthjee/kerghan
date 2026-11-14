/** Interval between sync-state polls while a sync runs, in milliseconds. */
export const POLL_INTERVAL_MS = 2000;

/**
 * Fixed-interval poller: runs an async `tick` every {@link POLL_INTERVAL_MS} until it answers
 * `false` or is stopped. A throwing tick (a transient error) keeps polling.
 */
export default class RepositoriesPoller {
  #tick;

  #generation = 0;

  #running = false;

  #timer = null;

  /**
   * Create the poller.
   *
   * @param {Function} tick - Async function; resolves `true` to keep polling, `false` to stop.
   */
  constructor(tick) {
    this.#tick = tick;
  }

  /**
   * Whether the poller is running.
   *
   * @returns {boolean} `true` while polling.
   */
  get running() {
    return this.#running;
  }

  /**
   * Start polling; does nothing when already running.
   *
   * @returns {void} Nothing.
   */
  start() {
    if (this.#running) {
      return;
    }

    this.#running = true;
    this.#schedule(this.#generation);
  }

  /**
   * Stop polling and drop any in-flight tick's outcome.
   *
   * @returns {void} Nothing.
   */
  stop() {
    this.#running = false;
    this.#generation += 1;
    clearTimeout(this.#timer);
    this.#timer = null;
  }

  #schedule(generation) {
    this.#timer = setTimeout(() => this.#run(generation), POLL_INTERVAL_MS);
  }

  async #run(generation) {
    let keepGoing;

    try {
      keepGoing = await this.#tick();
    } catch {
      keepGoing = true;
    }

    if (generation !== this.#generation) {
      return;
    }

    if (keepGoing) {
      this.#schedule(generation);
    } else {
      this.stop();
    }
  }
}
