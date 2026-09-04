const AUTH_CHANGED_EVENT = 'auth:changed';

/**
 * Shared `window`-event bus for auth-state changes. Wraps a single `CustomEvent` type so any
 * component — the header or otherwise, present or future — can react to a login/logout
 * transition independently, with zero coupling to whichever component/controller triggered it.
 * A plain class with static methods, matching {@link module:client/AuthSession}'s style.
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- static-methods-only
// utility/client class is this codebase's deliberate convention, matching client/AuthSession.js.
export default class AuthEvents {
  /**
   * Announce an auth-state change to every current subscriber.
   *
   * @param {boolean} loggedIn - Whether a session is now active.
   * @param {boolean} [isAdmin] - Whether the current session belongs to an admin user.
   * @returns {void} Nothing.
   */
  static emit(loggedIn, isAdmin = false) {
    window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: { loggedIn, isAdmin } }));
  }

  /**
   * Subscribe to auth-state changes.
   *
   * @param {Function} handler - Called with the `CustomEvent` whose `detail.loggedIn` carries
   *   the new auth state.
   * @returns {void} Nothing.
   */
  static subscribe(handler) {
    window.addEventListener(AUTH_CHANGED_EVENT, handler);
  }

  /**
   * Unsubscribe from auth-state changes.
   *
   * @param {Function} handler - The handler previously passed to {@link AuthEvents.subscribe}.
   * @returns {void} Nothing.
   */
  static unsubscribe(handler) {
    window.removeEventListener(AUTH_CHANGED_EVENT, handler);
  }
}
