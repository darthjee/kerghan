import Cooldown from '../integrations/cooldown.js';
import IntegrationTypes from '../integrations/types/index.js';

const HIGHLIGHT_REPLACE = new Set(['invalid', 'expired', 'undecryptable']);

const RECONNECT_LABELS = new Map([
  ['install', 'Reconnect: Install on GitHub'],
  ['connect', 'Reconnect: Connect existing installation'],
]);

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
 * Render one Reconnect button.
 *
 * @param {{id: string, status: string}} integration - The integration.
 * @param {{mode: (string|undefined), label: string, disabled: boolean}} button - The button's
 *   redirect mode (if the type has several), label and disabled flag.
 * @param {object} handlers - Page handlers.
 * @returns {React.ReactElement} The button.
 */
function renderReconnect(integration, { mode, label, disabled }, handlers) {
  return (
    <button
      key={mode ?? 'reconnect'}
      type="button"
      className={`btn btn-sm ${replaceVariant(integration)}`}
      disabled={disabled}
      onClick={handlers.onReconnect(integration, mode)}
    >
      {label}
    </button>
  );
}

/**
 * Render the Reconnect button(s) of a redirect-flow row: one per mode for a type offering
 * several (GitHub App), else a single *Reconnect with GitHub*. While the type is disabled on
 * the server, a type whose actions need the server config shows them disabled; any other is
 * hidden.
 *
 * @param {{id: string, type: string, status: string}} integration - The integration.
 * @param {object} definition - The integration's type definition.
 * @param {boolean} enabled - Whether the server enables the type.
 * @param {object} handlers - Page handlers.
 * @returns {React.ReactElement|Array<React.ReactElement>|null} The button(s), or `null`.
 */
function renderReconnectButtons(integration, definition, enabled, handlers) {
  if (!enabled && !definition.requiresServerConfig) {
    return null;
  }

  if (!definition.modes) {
    return renderReconnect(integration, { label: 'Reconnect with GitHub', disabled: false }, handlers);
  }

  return definition.modes.map((mode) => renderReconnect(
    integration, { mode, label: RECONNECT_LABELS.get(mode), disabled: !enabled }, handlers,
  ));
}

/**
 * Render the Replace credential button (or the Reconnect button(s) for a redirect-flow type);
 * hidden for a type without a frontend flow.
 *
 * @param {{id: string, type: string, status: string}} integration - The integration.
 * @param {boolean} enabled - Whether the server enables the type.
 * @param {object} handlers - Page handlers.
 * @returns {React.ReactElement|Array<React.ReactElement>|null} The button(s), or `null`.
 */
function renderReplaceButton(integration, enabled, handlers) {
  const definition = IntegrationTypes.get(integration.type);

  if (!definition) {
    return null;
  }

  if (definition.flow === 'redirect') {
    return renderReconnectButtons(integration, definition, enabled, handlers);
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
 * Whether the Test button is disabled: during the test cooldown, or while the type is disabled
 * on the server for a type whose test needs the server config (GitHub App).
 *
 * @param {object} integration - The integration.
 * @param {object} row - The row's UI state.
 * @param {boolean} enabled - Whether the server enables the type.
 * @returns {boolean} `true` when *Test* must be disabled.
 */
function isTestDisabled(integration, row, enabled) {
  if (!enabled && IntegrationTypes.get(integration.type)?.requiresServerConfig) {
    return true;
  }

  return Cooldown.isActive(integration, row);
}

/**
 * Rendering helper for an integration row's action buttons.
 */
const RowButtonsHelper = {
  /**
   * Whether a type is among the types the server enabled.
   *
   * @param {string} type - The integration type.
   * @param {Array<{type: string}>} types - The available type definitions.
   * @returns {boolean} `true` when the type is enabled.
   */
  isEnabled(type, types) {
    return types.some((definition) => definition.type === type);
  },

  /**
   * Render the row's buttons: rename, replace credential (or reconnect), test and remove.
   *
   * @param {{id: string, type: string}} integration - The integration.
   * @param {object} row - The row's UI state.
   * @param {Array<object>} types - The available type definitions.
   * @param {object} handlers - Page handlers.
   * @returns {React.ReactElement} The buttons.
   */
  render(integration, row, types, handlers) {
    const enabled = RowButtonsHelper.isEnabled(integration.type, types);

    return (
      <div className="d-flex flex-wrap gap-1 mb-2">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handlers.onStartRename(integration)}>
          Rename
        </button>
        {renderReplaceButton(integration, enabled, handlers)}
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          disabled={isTestDisabled(integration, row, enabled)}
          onClick={handlers.onTest(integration.id)}
        >
          Test
        </button>
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={handlers.onAskRemove(integration.id)}>
          Remove
        </button>
      </div>
    );
  },
};

export default RowButtonsHelper;
