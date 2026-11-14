/**
 * Per-repository Add state, keyed by `githubId`: `{ status: 'pending' }` or
 * `{ status: 'error', message, link? }`. Survives listing reloads; cleared on success or on
 * dispose.
 */
export default class AddStateStore {
  #entries = new Map();

  #publish;

  /**
   * Create the store.
   *
   * @param {Function} publish - Called with a fresh `Map` copy after every change.
   */
  constructor(publish) {
    this.#publish = publish;
  }

  /**
   * Mark an Add as running.
   *
   * @param {number} githubId - The repository's GitHub id.
   * @returns {void} Nothing.
   */
  pending(githubId) {
    this.#set(githubId, { status: 'pending' });
  }

  /**
   * Record an Add failure.
   *
   * @param {number} githubId - The repository's GitHub id.
   * @param {{message: string, link: (object|undefined)}} error - The inline error.
   * @returns {void} Nothing.
   */
  fail(githubId, error) {
    this.#set(githubId, { status: 'error', ...error });
  }

  /**
   * Forget a repository's Add state.
   *
   * @param {number} githubId - The repository's GitHub id.
   * @returns {void} Nothing.
   */
  clear(githubId) {
    this.#entries.delete(githubId);
    this.#publish(new Map(this.#entries));
  }

  /**
   * Forget every Add state.
   *
   * @returns {void} Nothing.
   */
  clearAll() {
    this.#entries = new Map();
    this.#publish(new Map());
  }

  #set(githubId, value) {
    this.#entries.set(githubId, value);
    this.#publish(new Map(this.#entries));
  }
}
