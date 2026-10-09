// TODO(#324-migration): remove `LEGACY_STORAGE_KEY`, `memoryStorage` and `takeLegacyToken`
// once every browser has migrated its legacy refresh token to the httpOnly cookie.
const LEGACY_STORAGE_KEY = 'kerghan_refresh_token';
const LOGGED_IN_COOKIE = 'logged_in=1';

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
 * Login-state hint reader plus the one-time legacy refresh-token migration helper.
 *
 * The refresh token itself lives in an httpOnly `refresh_token` cookie the frontend can neither
 * read nor send by hand; the backend also sets a readable `logged_in=1` hint cookie, which is
 * what {@link AuthSession.isLoggedIn} checks. A plain object module, matching
 * {@link module:client/ApiClient}'s style.
 */
const AuthSession = {
  /**
   * Read the raw cookie string. Falls back to an empty string when `document` is undefined
   * (Node-based specs / SSR), so specs can `spyOn(AuthSession, 'readCookies')`.
   *
   * @returns {string} The `document.cookie` string, or `''` when there is no DOM.
   */
  readCookies() {
    return typeof document === 'undefined' ? '' : document.cookie;
  },

  /**
   * Resolve the storage backend holding the legacy refresh token: the browser's `localStorage`
   * when available, an in-memory fallback otherwise.
   *
   * @returns {{getItem: Function, setItem: Function, removeItem: Function}} The storage backend.
   */
  storage() {
    return typeof localStorage === 'undefined' ? memoryStorage : localStorage;
  },

  /**
   * Check the `logged_in=1` hint cookie. It means "probably logged in"; `status.json` confirms.
   *
   * @returns {boolean} True when the `logged_in=1` hint cookie is present.
   */
  isLoggedIn() {
    return AuthSession.readCookies()
      .split(';')
      .some((cookie) => cookie.trim() === LOGGED_IN_COOKIE);
  },

  /**
   * Take the legacy refresh token left in `localStorage` by older builds, removing the key so
   * the migration runs at most once whatever its outcome.
   *
   * TODO(#324-migration): remove once the migration window is over.
   *
   * @returns {string|null} The legacy refresh token, or `null` when none was stored.
   */
  takeLegacyToken() {
    const storage = AuthSession.storage();
    const token = storage.getItem(LEGACY_STORAGE_KEY);

    storage.removeItem(LEGACY_STORAGE_KEY);

    return token;
  },
};

export default AuthSession;
