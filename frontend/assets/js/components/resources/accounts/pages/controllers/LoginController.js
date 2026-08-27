import AccountsClient from '../../../../../client/AccountsClient.js';

/**
 * Controller for the login page: submits credentials to {@link AccountsClient} and redirects
 * home on success. No client-side field validation — username/password are only checked
 * server-side, unlike Register's email format rule.
 */
export default class LoginController {
  /**
   * Create a login controller.
   *
   * @param {Function} setSubmitError - React state setter for the submit-time error message.
   * @param {typeof AccountsClient} [client] - Accounts HTTP client override, for testability.
   */
  constructor(setSubmitError, client = AccountsClient) {
    this.setSubmitError = setSubmitError;
    this.client = client;
  }

  /**
   * Submit the login form: authenticate against the backend and either redirect home on
   * success or set a submit-error message on failure.
   *
   * @param {{username: string, password: string}} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit(fields) {
    this.setSubmitError(null);

    try {
      await this.client.login(fields);
      this.#redirectHome();
    } catch (error) {
      this.setSubmitError(error.message);
    }
  }

  #redirectHome() {
    if (typeof window === 'undefined') {
      return;
    }

    window.location.hash = '/';
  }
}
