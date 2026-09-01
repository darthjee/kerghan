import AccountsClient from '../../../../../client/AccountsClient.js';

/**
 * Controller for the recover page: requests a password recovery email and always flips to the
 * "check your email" confirmation state, regardless of the outcome. This is the
 * enumeration-safety contract carried into the UI layer — a real network/server failure must
 * look identical to success to the end user, so the request's outcome is never branched on.
 */
export default class RecoverController {
  /**
   * Create a recover controller.
   *
   * @param {Function} setSent - React state setter flipping the page into its confirmation
   *   state.
   * @param {typeof AccountsClient} [client] - Accounts HTTP client override, for testability.
   */
  constructor(setSent, client = AccountsClient) {
    this.setSent = setSent;
    this.client = client;
  }

  /**
   * Submit the recovery request. Always flips to the confirmation state in a `finally` block,
   * whether the request resolves or rejects.
   *
   * @param {string} email - The account email to send a recovery link to.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit(email) {
    try {
      await this.client.recover(email);
    } finally {
      this.setSent(true);
    }
  }
}
