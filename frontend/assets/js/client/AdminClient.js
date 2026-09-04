import ApiClient from './ApiClient.js';

/**
 * HTTP client for admin-only requests (user lookup, recovery-link generation, and forced
 * recovery emails). Every route this hits requires the caller to be an admin — a `403`
 * `ApiError` means the current session is not an admin, which callers should treat as "hide the
 * UI / redirect away". Unlike {@link module:client/AccountsClient}, none of these touch
 * `AuthSession` — none of them affect the caller's own session.
 */
export default class AdminClient {
  /**
   * Search user accounts by username/email.
   *
   * @param {string} [q] - Search term matched against `username`/`email`; omit to list every
   *   account.
   * @returns {Promise<{users: Array<{id: number, username: string, email: string,
   *   isAdmin: boolean, createdAt: string}>}>} The matching accounts.
   */
  static async searchUsers(q) {
    return ApiClient.postJson('/admin/users/search.json', { q });
  }

  /**
   * Mint a fresh password-recovery link for a user, without invalidating their other
   * outstanding tokens.
   *
   * @param {number} userId - The target user's numeric id.
   * @returns {Promise<{resetUrl: string}>} The freshly minted recovery link.
   */
  static async generateRecoveryLink(userId) {
    return ApiClient.postJson(`/admin/users/${userId}/recovery-link.json`, {});
  }

  /**
   * Mint a fresh password-recovery token for a user and force-send the recovery email
   * synchronously, so the caller gets a real success/failure result.
   *
   * @param {number} userId - The target user's numeric id.
   * @returns {Promise<{sent: boolean}>} Whether the email was sent successfully.
   */
  static async sendRecoveryEmail(userId) {
    return ApiClient.postJson(`/admin/users/${userId}/send-recovery-email.json`, {});
  }
}
