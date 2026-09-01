import ApiClient from './ApiClient.js';
import AuthSession from './AuthSession.js';

/**
 * HTTP client for auth-related requests (registration, login, refresh, logout). Every method
 * that receives a fresh refresh token persists it via {@link AuthSession} before resolving,
 * and `logout` clears it regardless of whether the request itself succeeds — the client-side
 * session should still end.
 */
export default class AccountsClient {
  /**
   * Register a new account.
   *
   * @param {{username: string, email: string, password: string,
   *   passwordConfirmation: string}} fields - Registration form fields.
   * @returns {Promise<{user: object, refreshToken: string}>} The created account and its
   *   refresh token.
   */
  static async register({
    username, email, password, passwordConfirmation,
  }) {
    const result = await ApiClient.postJson('/auth/register.json', {
      username,
      email,
      password,
      password_confirmation: passwordConfirmation,
    });

    AuthSession.set(result.refreshToken);

    return result;
  }

  /**
   * Log in with a username and password.
   *
   * @param {{username: string, password: string}} credentials - Login credentials.
   * @returns {Promise<{user: object, refreshToken: string}>} The logged-in user and its
   *   refresh token.
   */
  static async login({ username, password }) {
    const result = await ApiClient.postJson('/auth/login.json', { username, password });

    AuthSession.set(result.refreshToken);

    return result;
  }

  /**
   * Rotate a refresh token for a fresh access token.
   *
   * @param {string} refreshToken - The current refresh token.
   * @returns {Promise<{user: object, refreshToken: string}>} The user and the renewed
   *   refresh token.
   */
  static async refresh(refreshToken) {
    const result = await ApiClient.postJson('/auth/refresh.json', { refreshToken });

    AuthSession.set(result.refreshToken);

    return result;
  }

  /**
   * Log out, invalidating the given refresh token server-side. The stored refresh token is
   * cleared even when the request fails, so the client-side session always ends.
   *
   * @param {string} refreshToken - The refresh token to invalidate.
   * @returns {Promise<void>} Resolves once logout handling finishes.
   */
  static async logout(refreshToken) {
    try {
      await ApiClient.deleteJson('/auth/logoff.json', { refreshToken });
    } finally {
      AuthSession.clear();
    }
  }

  /**
   * Check whether a refresh token is still active, without consuming or rotating it. Unlike
   * {@link AccountsClient.login}/{@link AccountsClient.refresh}, this does not touch
   * `AuthSession` itself — a `false` result means clearing a now-known-stale token, not setting
   * a new one, which is the caller's responsibility.
   *
   * @param {string} refreshToken - The refresh token to check.
   * @returns {Promise<{loggedIn: boolean}>} Whether the token is still active.
   */
  static async status(refreshToken) {
    return ApiClient.postJson('/auth/status.json', { refreshToken });
  }

  /**
   * Request a password recovery email. Unlike {@link AccountsClient.login}/
   * {@link AccountsClient.register}, this never touches `AuthSession` — this flow never issues
   * a refresh token.
   *
   * @param {string} email - The account email to send a recovery link to.
   * @returns {Promise<{sent: boolean}>} Always resolves; the backend never reveals whether the
   *   email matched an account.
   */
  static async recover(email) {
    return ApiClient.postJson('/auth/recover.json', { email });
  }

  /**
   * Complete a password recovery flow using the token from the recovery link. Unlike
   * {@link AccountsClient.login}/{@link AccountsClient.register}, this never touches
   * `AuthSession` — this flow never issues a refresh token.
   *
   * @param {{token: string, password: string, passwordConfirmation: string}} fields - The
   *   recovery token and new password fields.
   * @returns {Promise<{reset: boolean}>} Resolves on a successful reset; rejects with an
   *   `ApiError` on any rejection reason (unknown, used, or expired token).
   */
  static async resetPassword({ token, password, passwordConfirmation }) {
    return ApiClient.postJson('/auth/reset-password.json', {
      token,
      password,
      password_confirmation: passwordConfirmation,
    });
  }
}
