import ApiClient from './ApiClient.js';
import pickDefined from './pickDefined.js';

/**
 * HTTP client for auth-related requests (registration, login, refresh, logout). The refresh
 * token lives in an httpOnly `refresh_token` cookie the backend sets, reads and clears; this
 * client never reads, stores or sends it.
 */
const AccountsClient = {
  /**
   * Register a new account.
   *
   * @param {{username: string, email: string, password: string,
   *   passwordConfirmation: string}} fields - Registration form fields.
   * @returns {Promise<{user: object}>} The created account.
   */
  async register({
    username, email, password, passwordConfirmation,
  }) {
    return ApiClient.postJson('/auth/register.json', {
      username,
      email,
      password,
      password_confirmation: passwordConfirmation,
    });
  },

  /**
   * Log in with a username and password. `keepSignedIn` is always sent as a strict boolean
   * (`undefined` becomes `false`), since the backend rejects non-boolean values.
   *
   * @param {{username: string, password: string, keepSignedIn?: boolean}} credentials - Login
   *   credentials, plus whether the session should outlive the default TTL.
   * @returns {Promise<{user: object}>} The logged-in user.
   */
  async login({ username, password, keepSignedIn }) {
    return ApiClient.postJson('/auth/login.json', {
      username,
      password,
      keepSignedIn: Boolean(keepSignedIn),
    });
  },

  /**
   * Rotate the session's refresh token (carried by the httpOnly cookie) for a fresh access
   * token.
   *
   * @returns {Promise<{user: object}>} The user.
   */
  async refresh() {
    return ApiClient.postJson('/auth/refresh.json', {});
  },

  /**
   * One-time migration of a refresh token left in `localStorage` by older builds: posts it as
   * `{ refreshToken }` to `/auth/refresh.json` so the backend sets the cookies. Goes through the
   * raw path (no `401`-retry loop) and swallows any failure.
   *
   * TODO(#324-migration): remove once the migration window is over.
   *
   * @param {string} token - The legacy refresh token.
   * @returns {Promise<boolean>} `true` when the backend accepted the token, `false` otherwise.
   */
  async migrateLegacyToken(token) {
    try {
      await ApiClient.postJsonOnce('/auth/refresh.json', { refreshToken: token });

      return true;
    } catch {
      return false;
    }
  },

  /**
   * Log out, invalidating the current session server-side; the backend clears the session
   * cookies.
   *
   * @returns {Promise<void>} Resolves once logout handling finishes.
   */
  async logout() {
    await ApiClient.deleteJson('/auth/logoff.json', {});
  },

  /**
   * Check whether the current session (identified by the `refresh_token` cookie) is still
   * active, without consuming or rotating it. On `loggedIn: false` the backend clears the
   * session cookies.
   *
   * @returns {Promise<{loggedIn: boolean, isAdmin: boolean}>} Whether the session is still
   *   active, and whether it belongs to an admin user (always `false` when `loggedIn` is
   *   `false`).
   */
  async status() {
    return ApiClient.postJson('/auth/status.json', {});
  },

  /**
   * Request a password recovery email. Unlike {@link AccountsClient.login}/
   * {@link AccountsClient.register}, this flow never issues a session.
   *
   * @param {string} email - The account email to send a recovery link to.
   * @returns {Promise<{sent: boolean}>} Always resolves; the backend never reveals whether the
   *   email matched an account.
   */
  async recover(email) {
    return ApiClient.postJson('/auth/recover.json', { email });
  },

  /**
   * Complete a password recovery flow using the token from the recovery link. Unlike
   * {@link AccountsClient.login}/{@link AccountsClient.register}, this flow never issues a
   * session.
   *
   * @param {{token: string, password: string, passwordConfirmation: string}} fields - The
   *   recovery token and new password fields.
   * @returns {Promise<{reset: boolean}>} Resolves on a successful reset; rejects with an
   *   `ApiError` on any rejection reason (unknown, used, or expired token).
   */
  async resetPassword({ token, password, passwordConfirmation }) {
    return ApiClient.postJson('/auth/reset-password.json', {
      token,
      password,
      password_confirmation: passwordConfirmation,
    });
  },

  /**
   * Open an authorization request so an already-logged-in device can approve this login.
   * Unlike {@link AccountsClient.login}/{@link AccountsClient.register}, this flow never issues
   * a session. The response shape is identical for an unknown username (enumeration-safety).
   * `keepSignedIn` is always sent as a strict boolean, since the backend rejects non-boolean
   * values.
   *
   * @param {string} username - The username attempting to log in.
   * @param {boolean} [keepSignedIn=false] - Whether the approved session should be a
   *   long-lived "keep me signed in" session.
   * @returns {Promise<{uuid: string, pollToken: string, expiresAt: string}>} The request
   *   identifier, the token used to poll it, and its ISO-8601 expiry timestamp.
   */
  async createAuthorizationRequest(username, keepSignedIn = false) {
    return ApiClient.postJson('/auth/authorization-requests.json', {
      username,
      keepSignedIn: Boolean(keepSignedIn),
    });
  },

  /**
   * Poll an authorization request for its current status. When the status is `approved` the
   * response also carries `user` and the backend sets the session cookies, so the modal's
   * success path is identical to {@link AccountsClient.login}. Every other status (`open`,
   * `denied`, `expired`, `logged`) resolves untouched. An unknown `uuid` or wrong `pollToken`
   * surfaces as an `ApiError` with `.status === 404` thrown from {@link ApiClient}; it is not
   * caught here.
   *
   * @param {string} uuid - The authorization request identifier.
   * @param {string} pollToken - The token returned by
   *   {@link AccountsClient.createAuthorizationRequest}.
   * @returns {Promise<{status: string, user?: object}>} The current status, plus the user on
   *   the winning `approved` poll.
   */
  async pollAuthorizationRequest(uuid, pollToken) {
    return ApiClient.postJson(
      `/auth/authorization-requests/${uuid}/poll.json`,
      { pollToken },
    );
  },

  /**
   * List the caller's own open authorization requests, for the approving device to review.
   * Unlike {@link AccountsClient.login}/{@link AccountsClient.register}, this flow never issues
   * a session.
   *
   * @returns {Promise<{requests: Array<{uuid: string, requestIp: string,
   *   requestUserAgent: string, createdAt: string, expiresAt: string,
   *   keepSignedIn: boolean}>}>} The caller's open authorization requests.
   */
  async listAuthorizationRequests() {
    return ApiClient.postJson('/auth/authorization-requests/mine.json', {});
  },

  /**
   * Approve an authorization request as the account owner, confirming with the account
   * password. Unlike {@link AccountsClient.login}/{@link AccountsClient.register}, this flow
   * never issues a session. A `400` (wrong password, wrong owner, wrong status, or expired — the
   * backend collapses all of these into one message) surfaces as a thrown `ApiError`; it is not
   * caught here.
   *
   * @param {string} uuid - The authorization request identifier.
   * @param {string} password - The account owner's password, confirming the approval.
   * @returns {Promise<{authorized: boolean}>} Resolves once the request is authorized.
   */
  async authorizeAuthorizationRequest(uuid, password) {
    return ApiClient.postJson(
      `/auth/authorization-requests/${uuid}/authorize.json`,
      { password },
    );
  },

  /**
   * Deny an authorization request as the account owner. Unlike
   * {@link AccountsClient.login}/{@link AccountsClient.register}, this flow never issues a
   * session. Same `400`-as-thrown-`ApiError` behavior as
   * {@link AccountsClient.authorizeAuthorizationRequest}, it is not caught here.
   *
   * @param {string} uuid - The authorization request identifier.
   * @returns {Promise<{denied: boolean}>} Resolves once the request is denied.
   */
  async denyAuthorizationRequest(uuid) {
    return ApiClient.postJson(`/auth/authorization-requests/${uuid}/deny.json`, {});
  },

  /**
   * Update the caller's own account, confirming with the current password. On a password
   * change the backend keeps the session identified by the `refresh_token` cookie alive while
   * revoking the caller's other sessions; no token refresh or re-login is triggered on success.
   * `username`, `email`, and `newPassword` are only included in the request body when defined,
   * so callers may update any subset of them; a `newPasswordConfirmation` field is never sent —
   * that check is client-side only.
   *
   * @param {{currentPassword: string, username?: string, email?: string,
   *   newPassword?: string}} fields - The current password (always required) plus any fields
   *   to update.
   * @returns {Promise<{username: string, email: string}>} The account's updated username and
   *   email.
   */
  async updateAccount({
    currentPassword, username, email, newPassword,
  }) {
    return ApiClient.patchJson('/auth/account.json', {
      currentPassword,
      ...pickDefined({
        username, email, newPassword,
      }),
    });
  },

  /**
   * List the caller's sessions, most recently used first. The backend flags the session owning
   * the `refresh_token` cookie as `current`; a missing or unknown cookie flags none.
   *
   * @returns {Promise<{sessions: Array<{id: string, startedAt: string, lastUsedAt: string,
   *   keepSignedIn: boolean, current: boolean}>}>} The caller's sessions.
   */
  async listSessions() {
    return ApiClient.postJson('/auth/sessions/mine.json', {});
  },

  /**
   * Revoke one of the caller's sessions. A `404` (unknown/foreign id) or `400` (malformed id)
   * surfaces as a thrown `ApiError`; it is not caught here.
   *
   * @param {string} uuid - The session identifier.
   * @returns {Promise<{revoked: boolean}>} Resolves once the session is revoked.
   */
  async revokeSession(uuid) {
    return ApiClient.postJson(`/auth/sessions/${uuid}/revoke.json`, {});
  },

  /**
   * Revoke every session of the caller except the one owning the `refresh_token`
   * cookie.
   *
   * @returns {Promise<{revoked: boolean}>} Resolves once the other sessions are revoked.
   */
  async revokeOtherSessions() {
    return ApiClient.postJson('/auth/sessions/revoke-others.json', {});
  },
};

export default AccountsClient;
