import AccountsClient from '../../../../client/AccountsClient.js';
import AuthSession from '../../../../client/AuthSession.js';
import AuthEvents from '../../../../client/AuthEvents.js';
import LoginModalEvents from '../../../../client/LoginModalEvents.js';
import { redirectHome } from '../../../../utils/routing/redirects.js';

/**
 * Message surfaced when `DELETE /auth/logoff.json` fails, so the user knows the session is still
 * active and can retry.
 *
 * @type {string}
 */
export const LOGOUT_ERROR_MESSAGE = 'Could not sign out, please try again.';

/**
 * Controller for the Header's logout action and mount-time auth-status confirmation. Logout ends
 * the session via {@link AccountsClient.logout}; only once the backend confirms (and clears the
 * httpOnly session cookies) does the UI switch to logged out. A failed logout keeps the user
 * logged in and surfaces {@link LOGOUT_ERROR_MESSAGE}, since the cookies — which JS cannot clear —
 * are still valid.
 */
export default class HeaderController {
  /**
   * Create a header controller.
   *
   * @param {typeof AccountsClient} [client] - Accounts HTTP client override, for testability.
   */
  constructor(client = AccountsClient) {
    this.client = client;
  }

  /**
   * Log out the current session.
   *
   * @description Clears the JS-readable legacy `localStorage` refresh token up front (it is a
   * credential whatever the outcome), then calls the backend. On success the backend has cleared
   * the httpOnly session cookies, so the logged-out state is emitted and the user is redirected
   * home. On failure the cookies are still in place — JS cannot clear httpOnly cookies — so the
   * session is still valid: the user stays logged in and `onError` receives
   * {@link LOGOUT_ERROR_MESSAGE} so they can retry. `onError(null)` is called first, clearing any
   * previous failure.
   * @param {Function} [onError] - Called with the error message to show (or `null` to clear it).
   * @returns {Promise<boolean>} `true` when the logout succeeded, `false` otherwise.
   */
  async handleLogout(onError = () => undefined) {
    onError(null);
    AuthSession.takeLegacyToken(); // TODO(#324-migration): drop with the legacy token.

    try {
      await this.client.logout();
    } catch {
      onError(LOGOUT_ERROR_MESSAGE);
      return false;
    }

    AuthEvents.emit(false, false);
    redirectHome();
    return true;
  }

  /**
   * Open the login modal in the given mode via the shared {@link LoginModalEvents} bus. A pure
   * client-side state transition — issues no API call of its own.
   *
   * @param {string} mode - Which mode to open the modal in (`'password'` or `'register'`).
   * @returns {void} Nothing.
   */
  openLoginModal(mode) {
    LoginModalEvents.open(mode);
  }

  /**
   * One-time migration of a refresh token left in `localStorage` by older builds: takes it
   * (removing the key, so this runs at most once whatever its outcome) and, when present, posts
   * it via {@link AccountsClient.migrateLegacyToken} so the backend sets the session cookies.
   *
   * TODO(#324-migration): remove together with the backend's body-carried refresh fallback.
   *
   * @returns {Promise<void>} Resolves once the migration (if any) finishes.
   */
  async migrateIfNeeded() {
    const legacyToken = AuthSession.takeLegacyToken();

    if (legacyToken) {
      await this.client.migrateLegacyToken(legacyToken);
    }
  }

  /**
   * Confirm the current auth state against the backend and announce it via {@link AuthEvents}.
   * Runs {@link HeaderController#migrateIfNeeded} first, so a migrated legacy token is reflected
   * in the `logged_in` hint cookie before it is read.
   * Skips the network call entirely when the `logged_in` hint cookie is absent — that is
   * unambiguously "logged out". When the backend reports the session is no longer active, it
   * clears the cookies itself, so no client-side clearing is needed.
   *
   * @returns {Promise<void>} Resolves once the status check finishes.
   */
  async checkStatus() {
    await this.migrateIfNeeded(); // TODO(#324-migration): drop with migrateIfNeeded.

    if (!AuthSession.isLoggedIn()) {
      AuthEvents.emit(false, false);
      return;
    }

    const { loggedIn, isAdmin } = await this.client.status();

    AuthEvents.emit(loggedIn, isAdmin);
  }
}
