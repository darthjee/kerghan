const STORAGE_KEY = 'kerghan_refresh_token';

// Node-based Jasmine specs run without a DOM, so `localStorage` is undefined there; fall back
// to an in-memory store with the same `getItem`/`setItem`/`removeItem` shape, matching this
// codebase's other SSR-safe helpers (e.g. `HashRouteResolver`'s `defaultHashProvider`).
const memoryStorage = (() => {
  const store = new Map();

  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
})();

/**
 * Resolve the storage backend to use: the browser's `localStorage` when available, an
 * in-memory fallback otherwise.
 *
 * @returns {{getItem: Function, setItem: Function, removeItem: Function}} The storage backend.
 */
function storage() {
  return typeof localStorage === 'undefined' ? memoryStorage : localStorage;
}

/**
 * Thin wrapper around the single `localStorage` key holding the current refresh token. No
 * React/DOM dependency beyond `localStorage` itself — a plain class with static methods,
 * matching {@link module:client/ApiClient}'s style.
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- static-methods-only
// utility/client class is this codebase's deliberate convention, matching client/ApiClient.js.
export default class AuthSession {
  /**
   * Read the currently stored refresh token.
   *
   * @returns {string|null} The stored refresh token, or `null` when none is stored.
   */
  static get() {
    return storage().getItem(STORAGE_KEY);
  }

  /**
   * Persist a refresh token.
   *
   * @param {string} token - The refresh token to store.
   * @returns {void} Nothing.
   */
  static set(token) {
    storage().setItem(STORAGE_KEY, token);
  }

  /**
   * Clear the stored refresh token.
   *
   * @returns {void} Nothing.
   */
  static clear() {
    storage().removeItem(STORAGE_KEY);
  }

  /**
   * Check whether a refresh token is currently stored.
   *
   * @returns {boolean} True when a refresh token is stored.
   */
  static isLoggedIn() {
    return AuthSession.get() !== null;
  }
}
