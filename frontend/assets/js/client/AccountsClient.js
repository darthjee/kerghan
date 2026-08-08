import ApiClient from './ApiClient.js';

/**
 * HTTP client for account-related requests.
 */
export default class AccountsClient {
  /**
   * Register a new account.
   *
   * @param {{username: string, email: string, password: string,
   *   passwordConfirmation: string}} fields - Registration form fields.
   * @returns {Promise<{id: number, username: string, email: string}>} The created account.
   */
  static register({
    username, email, password, passwordConfirmation,
  }) {
    return ApiClient.postJson('/accounts/register.json', {
      username,
      email,
      password,
      password_confirmation: passwordConfirmation,
    });
  }
}
