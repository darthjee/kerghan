/**
 * One timer per integration row, firing when the row's *Test* cooldown ends so the page can
 * re-render and re-enable the button on its own.
 */
export default class CooldownTimers {
  #timers = new Map();

  #onExpire;

  /**
   * Create the timers registry.
   *
   * @param {Function} onExpire - Called with the row's uuid when its cooldown ends.
   */
  constructor(onExpire) {
    this.#onExpire = onExpire;
  }

  /**
   * Schedule a row's cooldown-end timer. A cooldown already over (or absent) schedules nothing;
   * an already-scheduled timer ending at the same time or later is kept.
   *
   * @param {string} uuid - The integration's uuid.
   * @param {number|null} endsAt - When the cooldown ends, in epoch milliseconds.
   * @returns {void} Nothing.
   */
  schedule(uuid, endsAt) {
    const now = Date.now();
    const current = this.#timers.get(uuid);

    if (endsAt === null || endsAt <= now || (current && current.endsAt >= endsAt)) {
      return;
    }

    this.clear(uuid);

    const id = setTimeout(() => {
      this.#timers.delete(uuid);
      this.#onExpire(uuid);
    }, endsAt - now);

    this.#timers.set(uuid, { id, endsAt });
  }

  /**
   * Cancel a row's timer, if any.
   *
   * @param {string} uuid - The integration's uuid.
   * @returns {void} Nothing.
   */
  clear(uuid) {
    const current = this.#timers.get(uuid);

    if (current) {
      clearTimeout(current.id);
      this.#timers.delete(uuid);
    }
  }

  /**
   * Cancel every timer (e.g. on unmount).
   *
   * @returns {void} Nothing.
   */
  clearAll() {
    [...this.#timers.keys()].forEach((uuid) => this.clear(uuid));
  }
}
