import Table from 'react-bootstrap/cjs/Table.js';

/**
 * Render the list-load error alert, if any.
 *
 * @param {{loadError: (string|null)}} state - Page state.
 * @returns {React.ReactElement|null} The error alert, or `null` when there is none.
 */
function renderLoadError(state) {
  if (!state.loadError) {
    return null;
  }

  return <div className="alert alert-danger">{state.loadError}</div>;
}

/**
 * Format an ISO-8601 timestamp as an absolute date-time in the browser's locale and timezone.
 *
 * @param {string} iso - The ISO-8601 timestamp.
 * @returns {string} The formatted date-time.
 */
function formatDateTime(iso) {
  return new Date(iso).toLocaleString();
}

/**
 * Render the sessions table, or an empty-state message when there are none.
 *
 * @param {{sessions: Array<object>, rowState: Map}} state - Page state.
 * @param {{onRevoke: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The rendered table or empty-state message.
 */
function renderSessionsTable(state, handlers) {
  if (state.sessions.length === 0) {
    return <p>No active sessions.</p>;
  }

  return (
    <Table striped bordered hover>
      <thead>
        <tr>
          <th>Started</th>
          <th>Last used</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {state.sessions.map((session) => renderRow(session, state.rowState, handlers))}
      </tbody>
    </Table>
  );
}

/**
 * Render a single session row, with its badges, Revoke action and row-level error.
 *
 * @param {{id: string, startedAt: string, lastUsedAt: string, keepSignedIn: boolean,
 *   current: boolean}} session - The row's session.
 * @param {Map} rowState - The per-session row UI state map, keyed by session id.
 * @param {{onRevoke: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The rendered row.
 */
function renderRow(session, rowState, handlers) {
  const row = rowState.get(session.id) ?? {};

  return (
    <tr key={session.id}>
      <td>
        {formatDateTime(session.startedAt)}
        {renderCurrentBadge(session)}
        {renderKeepSignedInBadge(session)}
      </td>
      <td>{formatDateTime(session.lastUsedAt)}</td>
      <td>
        {renderRevokeButton(session, handlers)}
        {renderError(row.error)}
      </td>
    </tr>
  );
}

/**
 * Render the "Current session" badge for the session owning the stored refresh token.
 *
 * @param {{current: boolean}} session - The row's session.
 * @returns {React.ReactElement|null} The badge, or `null` unless `current` is `true`.
 */
function renderCurrentBadge(session) {
  if (session.current !== true) {
    return null;
  }

  return <span className="badge text-bg-success ms-2">Current session</span>;
}

/**
 * Render the "Keep signed in" badge for a long-lived session.
 *
 * @param {{keepSignedIn: boolean}} session - The row's session.
 * @returns {React.ReactElement|null} The badge, or `null` unless `keepSignedIn` is `true`.
 */
function renderKeepSignedInBadge(session) {
  if (session.keepSignedIn !== true) {
    return null;
  }

  return <span className="badge text-bg-info ms-2">Keep signed in</span>;
}

/**
 * Render a row's Revoke button; the current session cannot be revoked from here.
 *
 * @param {{id: string, current: boolean}} session - The row's session.
 * @param {{onRevoke: Function}} handlers - Event handlers.
 * @returns {React.ReactElement|null} The button, or `null` for the current session.
 */
function renderRevokeButton(session, handlers) {
  if (session.current === true) {
    return null;
  }

  return (
    <button
      type="button"
      className="btn btn-sm btn-danger"
      onClick={handlers.onRevoke(session.id)}
    >
      Revoke
    </button>
  );
}

/**
 * Render an error message, if any.
 *
 * @param {(string|null|undefined)} error - The error message.
 * @returns {React.ReactElement|null} The error message, or `null` when there is none.
 */
function renderError(error) {
  if (!error) {
    return null;
  }

  return <div className="text-danger mt-1">{error}</div>;
}

/**
 * Tell whether "Sign out all other sessions" should be offered: only when some session is the
 * current one (otherwise the request would `401`) and at least one other session exists.
 *
 * @param {Array<{current: boolean}>} sessions - The caller's sessions.
 * @returns {boolean} Whether the control should be rendered.
 */
function canRevokeOthers(sessions) {
  return sessions.some((session) => session.current === true)
    && sessions.some((session) => session.current !== true);
}

/**
 * Render the "Sign out all other sessions" control: a button, or (once requested) a
 * confirmation prompt with Confirm/Cancel, followed by the page-level error.
 *
 * @param {{sessions: Array<object>, pageState: {confirmingRevokeOthers: boolean,
 *   error: (string|null)}}} state - Page state.
 * @param {{onRequestRevokeOthers: Function, onConfirmRevokeOthers: Function,
 *   onCancelRevokeOthers: Function}} handlers - Event handlers.
 * @returns {React.ReactElement|null} The control, or `null` when it should not be offered.
 */
function renderRevokeOthers(state, handlers) {
  if (!canRevokeOthers(state.sessions)) {
    return null;
  }

  return (
    <div className="mt-3">
      {state.pageState.confirmingRevokeOthers
        ? renderRevokeOthersConfirmation(handlers)
        : (
          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={handlers.onRequestRevokeOthers}
          >
            Sign out all other sessions
          </button>
        )}
      {renderError(state.pageState.error)}
    </div>
  );
}

/**
 * Render the confirmation prompt for signing out every other session.
 *
 * @param {{onConfirmRevokeOthers: Function, onCancelRevokeOthers: Function}} handlers - Event
 *   handlers.
 * @returns {React.ReactElement} The rendered confirmation prompt.
 */
function renderRevokeOthersConfirmation(handlers) {
  return (
    <div className="d-flex align-items-center gap-2">
      <span>Sign out every session except this one?</span>
      <button type="button" className="btn btn-sm btn-danger" onClick={handlers.onConfirmRevokeOthers}>
        Confirm
      </button>
      <button type="button" className="btn btn-sm btn-secondary" onClick={handlers.onCancelRevokeOthers}>
        Cancel
      </button>
    </div>
  );
}

/**
 * Rendering helper for the "My account → Sessions" page.
 */
const SessionsHelper = {
  /**
   * Render the Sessions page: the caller's sessions, each revocable unless current, plus a
   * "Sign out all other sessions" control.
   *
   * @param {{sessions: Array<object>, loadError: (string|null), rowState: Map,
   *   pageState: {confirmingRevokeOthers: boolean, error: (string|null)}}} state - Page state.
   * @param {{onRevoke: Function, onRequestRevokeOthers: Function,
   *   onConfirmRevokeOthers: Function, onCancelRevokeOthers: Function}} handlers - Event
   *   handlers.
   * @returns {React.ReactElement} The rendered Sessions page.
   */
  render(state, handlers) {
    return (
      <div className="container mt-4">
        <h1>Sessions</h1>
        {renderLoadError(state)}
        {renderSessionsTable(state, handlers)}
        {renderRevokeOthers(state, handlers)}
      </div>
    );
  },
};

export default SessionsHelper;
