import AccountsClient from '../../../../../client/AccountsClient.js';

/**
 * Controller for the "My account → Sessions" page: lists the caller's sessions and lets them
 * revoke any non-current one, or sign out every other session at once after a confirmation step.
 * Every method that reaches {@link AccountsClient} treats a falsy (`undefined`) result the same
 * way: return immediately, without touching any state — {@link module:client/ApiClient} already
 * opened the login modal itself on a session-expired `401`.
 */
export default class SessionsController {
  /**
   * Create a Sessions controller.
   *
   * @param {Function} setSessions - React state setter for the current list of sessions.
   * @param {Function} setLoadError - React state setter for the list-load error message.
   * @param {Function} setRowState - React state setter for the per-session row UI state, a
   *   `Map` keyed by session id whose values hold `{error}`.
   * @param {Function} setPageState - React state setter for the page-level UI state,
   *   `{confirmingRevokeOthers: boolean, error: string|null}`.
   * @param {typeof AccountsClient} [client] - Accounts HTTP client override, for testability.
   */
  constructor(setSessions, setLoadError, setRowState, setPageState, client = AccountsClient) {
    this.setSessions = setSessions;
    this.setLoadError = setLoadError;
    this.setRowState = setRowState;
    this.setPageState = setPageState;
    this.client = client;
  }

  /**
   * Load the caller's sessions, or store the load error on failure.
   *
   * @returns {Promise<void>} Resolves once the load finishes.
   */
  async load() {
    try {
      const result = await this.client.listSessions();

      if (!result) {
        return;
      }

      this.setSessions(result.sessions);
      this.setLoadError(null);
    } catch (error) {
      this.setLoadError(error.message);
    }
  }

  /**
   * Revoke a single session. On success the row error is cleared and the list reloaded, so the
   * revoked session drops off it; on failure the error message is stored against the row.
   *
   * @param {string} id - The session identifier.
   * @returns {Promise<void>} Resolves once the revocation (and, on success, the reload) finishes.
   */
  async revoke(id) {
    try {
      const result = await this.client.revokeSession(id);

      if (!result) {
        return;
      }

      this.patchRow(id, { error: null });
      await this.load();
    } catch (error) {
      this.patchRow(id, { error: error.message });
    }
  }

  /**
   * Open the "Sign out all other sessions" confirmation step, clearing any page error.
   *
   * @returns {void} Nothing.
   */
  requestRevokeOthers() {
    this.setPageState({ confirmingRevokeOthers: true, error: null });
  }

  /**
   * Close the "Sign out all other sessions" confirmation step, clearing any page error.
   *
   * @returns {void} Nothing.
   */
  cancelRevokeOthers() {
    this.setPageState({ confirmingRevokeOthers: false, error: null });
  }

  /**
   * Confirm signing out every other session. On success the confirmation closes and the list is
   * reloaded; on failure the confirmation closes and the message becomes the page-level error.
   *
   * @returns {Promise<void>} Resolves once the revocation (and, on success, the reload) finishes.
   */
  async confirmRevokeOthers() {
    try {
      const result = await this.client.revokeOtherSessions();

      if (!result) {
        return;
      }

      this.setPageState({ confirmingRevokeOthers: false, error: null });
      await this.load();
    } catch (error) {
      this.setPageState({ confirmingRevokeOthers: false, error: error.message });
    }
  }

  /**
   * Merge a patch into a single session row's UI state, preserving its other fields. The
   * row-state updater always returns a new `Map`, never mutating the current one.
   *
   * @param {string} id - The session identifier, used to key the row state.
   * @param {object} patch - The fields to merge into that row's state.
   * @returns {void} Nothing.
   */
  patchRow(id, patch) {
    this.setRowState((current) => new Map(current).set(id, { ...current.get(id), ...patch }));
  }
}
