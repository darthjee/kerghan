import Cooldown from '../integrations/cooldown.js';
import IntegrationTypes from '../integrations/types/index.js';
import CredentialFormHelper from './CredentialFormHelper.jsx';

const HIGHLIGHT_REPLACE = new Set(['invalid', 'expired', 'undecryptable']);

/**
 * Render the inline rename form.
 *
 * @param {{id: string}} integration - The integration.
 * @param {{label: string}} row - The row's UI state.
 * @param {object} handlers - Page handlers.
 * @returns {React.ReactElement} The rename form.
 */
function renderRenameForm(integration, row, handlers) {
  return (
    <form className="d-flex gap-2 mb-2" onSubmit={handlers.onSubmitRename(integration.id)}>
      <input
        type="text"
        aria-label="Label"
        className="form-control form-control-sm"
        value={row.label ?? ''}
        onChange={handlers.onRenameChange(integration.id)}
      />
      <button type="submit" className="btn btn-sm btn-primary">Save</button>
      <button type="button" className="btn btn-sm btn-link" onClick={handlers.onCancelRename(integration.id)}>
        Cancel
      </button>
    </form>
  );
}

/**
 * Whether a type is among the types the server enabled.
 *
 * @param {string} type - The integration type.
 * @param {Array<{type: string}>} types - The available type definitions.
 * @returns {boolean} `true` when the type is enabled.
 */
function isEnabled(type, types) {
  return types.some((definition) => definition.type === type);
}

/**
 * Bootstrap variant of the Replace credential / Reconnect button: highlighted for `invalid`,
 * `expired` and `undecryptable`.
 *
 * @param {{status: string}} integration - The integration.
 * @returns {string} The button variant class.
 */
function replaceVariant(integration) {
  return HIGHLIGHT_REPLACE.has(integration.status) ? 'btn-warning' : 'btn-outline-secondary';
}

/**
 * Render the Reconnect with GitHub button of a redirect-flow row, hidden while its type is
 * disabled on the server.
 *
 * @param {{id: string, type: string, status: string}} integration - The integration.
 * @param {Array<object>} types - The available type definitions.
 * @param {object} handlers - Page handlers.
 * @returns {React.ReactElement|null} The button, or `null` when the type is disabled.
 */
function renderReconnectButton(integration, types, handlers) {
  if (!isEnabled(integration.type, types)) {
    return null;
  }

  return (
    <button
      type="button"
      className={`btn btn-sm ${replaceVariant(integration)}`}
      onClick={handlers.onReconnect(integration)}
    >
      Reconnect with GitHub
    </button>
  );
}

/**
 * Render the Replace credential button (or Reconnect with GitHub for a redirect-flow type);
 * hidden for a type without a frontend flow.
 *
 * @param {{id: string, type: string, status: string}} integration - The integration.
 * @param {Array<object>} types - The available type definitions.
 * @param {object} handlers - Page handlers.
 * @returns {React.ReactElement|null} The button, or `null` for a type not implemented.
 */
function renderReplaceButton(integration, types, handlers) {
  const definition = IntegrationTypes.get(integration.type);

  if (!definition) {
    return null;
  }

  if (definition.flow === 'redirect') {
    return renderReconnectButton(integration, types, handlers);
  }

  return (
    <button
      type="button"
      className={`btn btn-sm ${replaceVariant(integration)}`}
      onClick={handlers.onStartReplace(integration.id)}
    >
      Replace credential
    </button>
  );
}

/**
 * Render the "disabled on this server" note of a redirect-flow row whose type the server
 * doesn't enable (so it can't be reconnected).
 *
 * @param {{type: string}} integration - The integration.
 * @param {Array<object>} types - The available type definitions.
 * @returns {React.ReactElement|null} The note, or `null` for an enabled or paste-flow type.
 */
function renderDisabledNote(integration, types) {
  const definition = IntegrationTypes.get(integration.type);

  if (definition?.flow !== 'redirect' || isEnabled(integration.type, types)) {
    return null;
  }

  return <div className="small text-muted mb-2">{`The ${definition.name} is disabled on this server.`}</div>;
}

/**
 * Render the row's action buttons (or the rename form while renaming).
 *
 * @param {{id: string}} integration - The integration.
 * @param {object} row - The row's UI state.
 * @param {Array<object>} types - The available type definitions.
 * @param {object} handlers - Page handlers.
 * @returns {React.ReactElement} The buttons.
 */
function renderButtons(integration, row, types, handlers) {
  if (row.renaming) {
    return renderRenameForm(integration, row, handlers);
  }

  return (
    <div className="d-flex flex-wrap gap-1 mb-2">
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handlers.onStartRename(integration)}>
        Rename
      </button>
      {renderReplaceButton(integration, types, handlers)}
      <button
        type="button"
        className="btn btn-sm btn-outline-primary"
        disabled={Cooldown.isActive(integration, row)}
        onClick={handlers.onTest(integration.id)}
      >
        Test
      </button>
      <button type="button" className="btn btn-sm btn-outline-danger" onClick={handlers.onAskRemove(integration.id)}>
        Remove
      </button>
    </div>
  );
}

/**
 * Render the replace-credential form while it is open.
 *
 * @param {{id: string, type: string}} integration - The integration.
 * @param {object} row - The row's UI state.
 * @param {object} handlers - Page handlers.
 * @returns {React.ReactElement|null} The form, or `null` when closed or for a redirect-flow
 *   type (reconnected through GitHub instead).
 */
function renderReplaceForm(integration, row, handlers) {
  const definition = IntegrationTypes.get(integration.type);

  if (!row.replacing || !definition || definition.flow === 'redirect') {
    return null;
  }

  return CredentialFormHelper.renderForm(
    {
      definition,
      idPrefix: `replace-${integration.id}`,
      credential: row.credential,
      error: null,
      title: 'Replace credential',
      submitLabel: 'Replace',
    },
    {
      onSubmit: handlers.onSubmitReplace(integration),
      onCredentialChange: (field) => handlers.onReplaceCredentialChange(integration.id, field),
      onCancel: handlers.onCancelReplace(integration.id),
    },
  );
}

/**
 * Render the remove confirmation while it is open, naming the label and the type's reminder.
 *
 * @param {{id: string, type: string, label: string}} integration - The integration.
 * @param {object} row - The row's UI state.
 * @param {object} handlers - Page handlers.
 * @returns {React.ReactElement|null} The confirmation, or `null` when closed.
 */
function renderRemoveConfirmation(integration, row, handlers) {
  if (!row.confirmingRemove) {
    return null;
  }

  return (
    <div className="alert alert-warning mb-2">
      <p className="mb-1">{`Remove "${integration.label}"?`}</p>
      <p className="small mb-2">{IntegrationTypes.removeReminderFor(integration)}</p>
      <button type="button" className="btn btn-sm btn-danger me-2" onClick={handlers.onConfirmRemove(integration.id)}>
        Confirm remove
      </button>
      <button type="button" className="btn btn-sm btn-link" onClick={handlers.onCancelRemove(integration.id)}>
        Cancel
      </button>
    </div>
  );
}

/**
 * Render the row's last-action error, if any.
 *
 * @param {{error: (string|null)}} row - The row's UI state.
 * @returns {React.ReactElement|null} The error, or `null` without one.
 */
function renderRowError(row) {
  if (!row.error) {
    return null;
  }

  return <div className="text-danger">{row.error}</div>;
}

/**
 * Rendering helper for an integration row's Actions cell.
 */
const IntegrationActionsHelper = {
  /**
   * Render the Actions cell: rename, replace credential (or reconnect), test (disabled during the cooldown)
   * and remove, plus whichever inline form or confirmation is open, and the row's error.
   *
   * @param {object} integration - The integration.
   * @param {object} row - The row's UI state.
   * @param {object} handlers - Page handlers.
   * @param {Array<object>} [types] - The available (server-enabled) type definitions; a
   *   redirect-flow row can only be reconnected while its type is among them.
   * @returns {React.ReactElement} The Actions cell content.
   */
  render(integration, row, handlers, types = []) {
    return (
      <>
        {renderButtons(integration, row, types, handlers)}
        {renderDisabledNote(integration, types)}
        {renderReplaceForm(integration, row, handlers)}
        {renderRemoveConfirmation(integration, row, handlers)}
        {renderRowError(row)}
      </>
    );
  },
};

export default IntegrationActionsHelper;
