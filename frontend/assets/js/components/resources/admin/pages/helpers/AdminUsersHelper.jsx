import Table from 'react-bootstrap/cjs/Table.js';

/**
 * Rendering helper for the Admin Users page.
 */
export default class AdminUsersHelper {
  /**
   * Render the Admin Users page: a search form and, once searched, a table of matching
   * accounts.
   *
   * @param {{query: string, users: Array<object>, rowResults: object,
   *   searchError: (string|null)}} state - Page state.
   * @param {{onSubmit: Function, onQueryChange: Function, onGenerateLink: Function,
   *   onSendEmail: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The rendered Admin Users page.
   */
  static render(state, handlers) {
    return (
      <div className="container mt-4">
        <h1>Admin Users</h1>
        {AdminUsersHelper.#renderSearchForm(state, handlers)}
        {AdminUsersHelper.#renderSearchError(state)}
        {AdminUsersHelper.#renderUsersTable(state, handlers)}
      </div>
    );
  }

  /**
   * Render the search form.
   *
   * @param {{query: string}} state - Page state.
   * @param {{onSubmit: Function, onQueryChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The rendered search form.
   */
  static #renderSearchForm(state, handlers) {
    return (
      <form onSubmit={handlers.onSubmit} className="mb-3" noValidate>
        <div className="input-group">
          <input
            type="text"
            className="form-control"
            placeholder="Search by username or email"
            value={state.query}
            onChange={handlers.onQueryChange}
          />
          <button type="submit" className="btn btn-primary">Search</button>
        </div>
      </form>
    );
  }

  /**
   * Render the search-time error alert, if any.
   *
   * @param {{searchError: (string|null)}} state - Page state.
   * @returns {React.ReactElement|null} The error alert, or `null` when there is none.
   */
  static #renderSearchError(state) {
    if (!state.searchError) {
      return null;
    }

    return <div className="alert alert-danger">{state.searchError}</div>;
  }

  /**
   * Render the matching-accounts table, or a "no results" message when the current search
   * (including the initial, not-yet-searched state) has no results.
   *
   * @param {{users: Array<object>, rowResults: object}} state - Page state.
   * @param {{onGenerateLink: Function, onSendEmail: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The rendered table or "no results" message.
   */
  static #renderUsersTable(state, handlers) {
    if (state.users.length === 0) {
      return <p>No users found.</p>;
    }

    return (
      <Table striped bordered hover>
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Email</th>
            <th>Admin</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {state.users.map(
            (user) => AdminUsersHelper.#renderRow(user, state.rowResults, handlers),
          )}
        </tbody>
      </Table>
    );
  }

  /**
   * Render a single user row, with its "Generate link"/"Send email" actions and whatever
   * per-row result the controller is currently holding for that user.
   *
   * @param {{id: number, username: string, email: string, isAdmin: boolean}} user - The row's
   *   user account.
   * @param {object} rowResults - The per-user last-action result map, keyed by user id.
   * @param {{onGenerateLink: Function, onSendEmail: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The rendered row.
   */
  static #renderRow(user, rowResults, handlers) {
    return (
      <tr key={user.id}>
        <td>{user.id}</td>
        <td>{user.username}</td>
        <td>{user.email}</td>
        <td>{user.isAdmin ? 'Yes' : 'No'}</td>
        <td>
          <button
            type="button"
            className="btn btn-sm btn-secondary me-2"
            onClick={handlers.onGenerateLink(user.id)}
          >
            Generate link
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary me-2"
            onClick={handlers.onSendEmail(user.id)}
          >
            Send email
          </button>
          {/* eslint-disable-next-line security/detect-object-injection -- user.id is a numeric
              id from the search response, used only to key into a map this page itself built;
              never an attacker-controlled property name. */}
          {AdminUsersHelper.#renderRowResult(rowResults[user.id])}
        </td>
      </tr>
    );
  }

  /**
   * Render the last-action result for a single row: a copyable recovery link, a send-email
   * outcome, an error message, or nothing when no action has been taken yet.
   *
   * @param {{resetUrl: string}|{sent: boolean}|{error: string}|undefined} result - The row's
   *   last-action result, if any.
   * @returns {React.ReactElement|null} The rendered result, or `null` when there is none.
   */
  static #renderRowResult(result) {
    if (!result) {
      return null;
    }

    if (result.error) {
      return <div className="text-danger mt-1">{result.error}</div>;
    }

    if (result.resetUrl) {
      return (
        <input
          type="text"
          readOnly
          className="form-control form-control-sm mt-1"
          value={result.resetUrl}
        />
      );
    }

    return <div className="mt-1">{result.sent ? 'Email sent' : 'Email failed to send'}</div>;
  }
}
