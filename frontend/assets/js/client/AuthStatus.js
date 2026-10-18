import AccountsClient from './AccountsClient.js';
import AuthEvents from './AuthEvents.js';

/** The `status.json` `status` value marking an account awaiting an administrator's approval. */
const PENDING_STATUS = 'pending';

/**
 * Shared "ask the backend for the current auth state and announce it" step. `status.json` is the
 * single source of a user's approval status, so every place that needs to (re)learn the auth
 * state — the header's mount-time check, a successful login or registration, the
 * awaiting-approval re-check — goes through {@link AuthStatus.refresh} instead of assuming a
 * logged-in state. A plain object module, matching {@link module:client/AuthEvents}'s style.
 */
const AuthStatus = {
  /**
   * Fetch the current auth state and emit it on the {@link AuthEvents} bus.
   *
   * @description Calls `status()` on the given client and emits `(loggedIn, isAdmin, pending)`,
   * where `pending` is `true` only for a `status: "pending"` answer (whose `loggedIn` and
   * `isAdmin` are then `false`). Errors from the client propagate to the caller.
   * @param {{status: Function}} [client] - Accounts HTTP client override, for testability.
   * @returns {Promise<{loggedIn: boolean, isAdmin: boolean, pending: boolean}>} The announced
   *   auth state.
   */
  async refresh(client = AccountsClient) {
    const { loggedIn, isAdmin, status } = await client.status();
    const state = {
      loggedIn: Boolean(loggedIn),
      isAdmin: Boolean(isAdmin),
      pending: status === PENDING_STATUS,
    };

    AuthEvents.emit(state.loggedIn, state.isAdmin, state.pending);

    return state;
  },
};

export default AuthStatus;
