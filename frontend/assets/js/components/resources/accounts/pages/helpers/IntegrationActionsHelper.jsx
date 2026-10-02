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
 * Render the Replace credential button, highlighted for `invalid`, `expired` and
 * `undecryptable`; hidden for a type without a frontend flow.
 *
 * @param {{id: string, type: string, status: string}} integration - The integration.
 * @param {object} handlers - Page handlers.
 * @returns {React.ReactElement|null} The button, or `null` for a type not implemented.
 */
function renderReplaceButton(integration, handlers) {
  if (!IntegrationTypes.get(integration.type)) {
    return null;
  }

  const variant = HIGHLIGHT_REPLACE.has(integration.status) ? 'btn-warning' : 'btn-outline-secondary';

  return (
    <button type="button" className={`btn btn-sm ${variant}`} onClick={handlers.onStartReplace(integration.id)}>
      Replace credential
    </button>
  );
}

/**
 * Render the row's action buttons (or the rename form while renaming).
 *
 * @param {{id: string}} integration - The integration.
 * @param {object} row - The row's UI state.
 * @param {object} handlers - Page handlers.
 * @returns {React.ReactElement} The buttons.
 */
function renderButtons(integration, row, handlers) {
  if (row.renaming) {
    return renderRenameForm(integration, row, handlers);
  }

  return (
    <div className="d-flex flex-wrap gap-1 mb-2">
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handlers.onStartRename(integration)}>
        Rename
      </button>
      {renderReplaceButton(integration, handlers)}
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
 * @returns {React.ReactElement|null} The form, or `null` when closed.
 */
function renderReplaceForm(integration, row, handlers) {
  const definition = IntegrationTypes.get(integration.type);

  if (!row.replacing || !definition) {
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
      <p className="small mb-2">{IntegrationTypes.get(integration.type)?.removeReminder}</p>
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
   * Render the Actions cell: rename, replace credential, test (disabled during the cooldown)
   * and remove, plus whichever inline form or confirmation is open, and the row's error.
   *
   * @param {object} integration - The integration.
   * @param {object} row - The row's UI state.
   * @param {object} handlers - Page handlers.
   * @returns {React.ReactElement} The Actions cell content.
   */
  render(integration, row, handlers) {
    return (
      <>
        {renderButtons(integration, row, handlers)}
        {renderReplaceForm(integration, row, handlers)}
        {renderRemoveConfirmation(integration, row, handlers)}
        {renderRowError(row)}
      </>
    );
  },
};

export default IntegrationActionsHelper;
