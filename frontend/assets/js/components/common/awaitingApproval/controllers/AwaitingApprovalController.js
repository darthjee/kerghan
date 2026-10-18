import AccountsClient from '../../../../client/AccountsClient.js';
import AuthStatus from '../../../../client/AuthStatus.js';
import HeaderController from '../../header/controllers/HeaderController.js';

/**
 * Message surfaced when a "Check again" (or window-focus) re-check of `status.json` fails, so the
 * user knows nothing changed and can retry.
 *
 * @type {string}
 */
export const RECHECK_ERROR_MESSAGE = 'Could not check your account status, please try again.';

/**
 * Controller for the awaiting-approval view. Re-checks the account status through the shared
 * {@link AuthStatus.refresh} (whose emit on the `AuthEvents` bus is what swaps the view for the
 * app once approved, or for the logged-out state otherwise), and logs out by reusing
 * {@link HeaderController#handleLogout}. Never polls on a timer.
 */
export default class AwaitingApprovalController {
  /**
   * Create an awaiting-approval controller.
   *
   * @param {Function} setError - React state setter for the view's error message.
   * @param {typeof AccountsClient} [client] - Accounts HTTP client override, for testability.
   * @param {HeaderController} [headerController] - Controller whose logout is reused, for
   *   testability.
   */
  constructor(setError, client = AccountsClient, headerController = new HeaderController(client)) {
    this.setError = setError;
    this.client = client;
    this.headerController = headerController;
  }

  /**
   * Re-check `status.json` and announce the answer.
   *
   * @description Clears any previous error, then calls {@link AuthStatus.refresh}. An approved
   * answer emits the logged-in state, a logged-out one the logged-out state (nothing says the
   * account was denied), a pending one keeps the view. A failed request sets
   * {@link RECHECK_ERROR_MESSAGE}.
   * @returns {Promise<void>} Resolves once the re-check finishes.
   */
  async checkAgain() {
    this.setError(null);

    try {
      await AuthStatus.refresh(this.client);
    } catch {
      this.setError(RECHECK_ERROR_MESSAGE);
    }
  }

  /**
   * Log out the pending session via {@link HeaderController#handleLogout}, which calls
   * `DELETE /auth/logoff.json`, emits the logged-out state and redirects home; a failure is
   * reported through the view's error setter.
   *
   * @returns {Promise<boolean>} `true` when the logout succeeded, `false` otherwise.
   */
  logout() {
    return this.headerController.handleLogout(this.setError);
  }
}
