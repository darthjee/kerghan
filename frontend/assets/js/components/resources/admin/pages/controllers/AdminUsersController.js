import AdminClient from '../../../../../client/AdminClient.js';
import { redirectIfForbidden } from '../../../../../utils/routing/redirects.js';

const DENY_CONFIRMATION = 'Deny this user? This is final and logs them out everywhere.';

/**
 * Ask the browser to confirm an action, resolved lazily so the controller can be built where no
 * `window` exists (e.g. specs).
 *
 * @param {string} message - The confirmation prompt.
 * @returns {boolean} Whether the user confirmed.
 */
function browserConfirm(message) {
  return window.confirm(message);
}

/**
 * Controller for the Admin Users page: searches user accounts (optionally by approval status),
 * approves / denies them, and mints/sends recovery links for a specific one. Every method treats a `403` `ApiError` the same way: redirect home, the
 * same way `LoginController`/`HeaderController` redirect — this is the fallback for the page
 * being reached directly by hash despite the current session not being an admin.
 */
export default class AdminUsersController {
  /**
   * Create an Admin Users controller.
   *
   * @param {Function} setUsers - React state setter for the current search results.
   * @param {Function} setRowResults - React state setter for the per-user last-action result map
   *   (keyed by user id), holding either `{resetUrl}`, `{sent}`, or `{error}`.
   * @param {Function} setSearchError - React state setter for the search-time error message.
   * @param {Function} setCurrentUserId - React state setter for the calling admin's own id.
   * @param {typeof AdminClient} [client] - Admin HTTP client override, for testability.
   * @param {Function} [confirm] - Confirmation prompt override (defaults to `window.confirm`),
   *   for testability.
   */
  constructor(
    setUsers,
    setRowResults,
    setSearchError,
    setCurrentUserId,
    client = AdminClient,
    confirm = browserConfirm,
  ) {
    this.setUsers = setUsers;
    this.setRowResults = setRowResults;
    this.setSearchError = setSearchError;
    this.setCurrentUserId = setCurrentUserId;
    this.client = client;
    this.confirm = confirm;
  }

  /**
   * Search user accounts and store the results and the calling admin's id, or the search error
   * on failure.
   *
   * @param {string} q - Search term matched against `username`/`email`.
   * @param {'pending'|'approved'|'denied'} [status] - Approval status filter; omit for all.
   * @returns {Promise<void>} Resolves once the search finishes.
   */
  async handleSearch(q, status) {
    this.setSearchError(null);

    try {
      const { users, currentUserId } = await this.client.searchUsers(q, status);
      this.setUsers(users);
      this.setCurrentUserId(currentUserId);
    } catch (error) {
      this.#handleTopLevelError(error);
    }
  }

  /**
   * Approve a pending user and replace their row with the updated account.
   *
   * @param {number} userId - The target user's numeric id.
   * @returns {Promise<void>} Resolves once the request finishes.
   */
  async handleApprove(userId) {
    try {
      const { user } = await this.client.approveUser(userId);
      this.#replaceUser(user);
    } catch (error) {
      this.#handleRowError(userId, error);
    }
  }

  /**
   * Deny a user after confirmation and replace their row with the updated account. A cancelled
   * confirmation sends nothing.
   *
   * @param {number} userId - The target user's numeric id.
   * @returns {Promise<void>} Resolves once the request finishes (or immediately on cancel).
   */
  async handleDeny(userId) {
    if (!this.confirm(DENY_CONFIRMATION)) {
      return;
    }

    try {
      const { user } = await this.client.denyUser(userId);
      this.#replaceUser(user);
    } catch (error) {
      this.#handleRowError(userId, error);
    }
  }

  /**
   * Mint a fresh recovery link for a user and store it against that user's row.
   *
   * @param {number} userId - The target user's numeric id.
   * @returns {Promise<void>} Resolves once the request finishes.
   */
  async handleGenerateLink(userId) {
    try {
      const { resetUrl } = await this.client.generateRecoveryLink(userId);
      this.#setRowResult(userId, { resetUrl });
    } catch (error) {
      this.#handleRowError(userId, error);
    }
  }

  /**
   * Force-send a recovery email to a user and store the outcome against that user's row.
   *
   * @param {number} userId - The target user's numeric id.
   * @returns {Promise<void>} Resolves once the request finishes.
   */
  async handleSendEmail(userId) {
    try {
      const { sent } = await this.client.sendRecoveryEmail(userId);
      this.#setRowResult(userId, { sent });
    } catch (error) {
      this.#handleRowError(userId, error);
    }
  }

  #replaceUser(updated) {
    this.setUsers((current) => current.map(
      (user) => (user.id === updated.id ? updated : user),
    ));
    this.#setRowResult(updated.id, undefined);
  }

  #setRowResult(userId, result) {
    this.setRowResults((current) => ({ ...current, [userId]: result }));
  }

  #handleTopLevelError(error) {
    if (redirectIfForbidden(error)) {
      return;
    }

    this.setSearchError(error.message);
  }

  #handleRowError(userId, error) {
    if (redirectIfForbidden(error)) {
      return;
    }

    this.#setRowResult(userId, { error: error.message });
  }
}
