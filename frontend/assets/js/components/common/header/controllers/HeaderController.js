import AccountsClient from '../../../../client/AccountsClient.js';
import AuthSession from '../../../../client/AuthSession.js';

/**
 * Controller for the Header's logout action: ends the session via {@link AccountsClient.logout}
 * and redirects home regardless of whether the request succeeded — `AccountsClient.logout`
 * already clears `AuthSession` unconditionally.
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
   * Log out the current session and redirect home. Always redirects, even when the logout
   * request itself fails, since `AccountsClient.logout` already clears `AuthSession`
   * client-side unconditionally.
   *
   * @returns {Promise<void>} Resolves once logout handling finishes.
   */
  async handleLogout() {
    try {
      await this.client.logout(AuthSession.get());
    } catch {
      // Ignored: the client-side session is already cleared by AccountsClient.logout,
      // regardless of whether the network request itself succeeded.
    } finally {
      this.#redirectHome();
    }
  }

  #redirectHome() {
    if (typeof window === 'undefined') {
      return;
    }

    window.location.hash = '/';
  }
}
