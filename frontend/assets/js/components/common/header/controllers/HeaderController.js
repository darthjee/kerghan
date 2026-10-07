import AccountsClient from '../../../../client/AccountsClient.js';
import AuthSession from '../../../../client/AuthSession.js';
import AuthEvents from '../../../../client/AuthEvents.js';
import LoginModalEvents from '../../../../client/LoginModalEvents.js';
import { redirectHome } from '../../../../utils/routing/redirects.js';

/**
 * Controller for the Header's logout action and mount-time auth-status confirmation. Logout ends
 * the session via {@link AccountsClient.logout} and redirects home regardless of whether the
 * request succeeded — the backend clears the session cookies.
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
   * Log out the current session and redirect home. Always redirects and emits the new
   * `false` auth state, even when the logout request itself fails, so the client-side state
   * always ends logged out.
   *
   * @returns {Promise<void>} Resolves once logout handling finishes.
   */
  async handleLogout() {
    try {
      await this.client.logout();
    } catch {
      // Ignored: the client-side state still ends logged out, regardless of whether the
      // network request itself succeeded.
    } finally {
      AuthEvents.emit(false, false);
      redirectHome();
    }
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
