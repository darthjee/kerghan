import Table from 'react-bootstrap/cjs/Table.js';
import IntegrationFormatters from '../integrations/formatters.js';
import IntegrationTypes from '../integrations/types/index.js';
import IntegrationActionsHelper from './IntegrationActionsHelper.jsx';

const STATUS_BADGES = new Map([
  ['active', 'text-bg-success'],
  ['invalid', 'text-bg-danger'],
  ['expired', 'text-bg-warning'],
  ['undecryptable', 'text-bg-secondary'],
]);

const TEST_RESULTS = new Map([
  ['success', 'success'],
  ['rejected', 'rejected'],
  ['transient_error', 'transient error'],
  ['undecryptable', 'undecryptable'],
]);

const UNDECRYPTABLE_TEXT = "The stored credential can't currently be read. Test it again (it "
  + 'recovers if the key was fixed), replace it, or remove it.';

/**
 * Render the explanation under a status badge: the `invalid` reason text, or the
 * `undecryptable` explanation.
 *
 * @param {{type: string, status: string, statusReason: (string|null)}} integration - The
 *   integration.
 * @returns {React.ReactElement|null} The explanation, or `null` for other statuses.
 */
function renderStatusDetail(integration) {
  if (integration.status === 'undecryptable') {
    return <div className="small">{UNDECRYPTABLE_TEXT}</div>;
  }

  if (integration.status !== 'invalid' || !integration.statusReason) {
    return null;
  }

  return <div className="small">{IntegrationTypes.reasonText(integration.type, integration.statusReason)}</div>;
}

/**
 * Render the shared-login hint, when another integration uses the same GitHub login.
 *
 * @param {string|null} githubLogin - The integration's GitHub login.
 * @param {Set<string>} sharedLogins - Logins shared by several integrations.
 * @returns {React.ReactElement|null} The hint, or `null` when the login is not shared.
 */
function renderSharedLoginHint(githubLogin, sharedLogins) {
  if (!sharedLogins.has(githubLogin)) {
    return null;
  }

  return <div className="small text-muted">Another integration uses this GitHub account.</div>;
}

/**
 * Render the type-specific details under the GitHub account (e.g. a GitHub App installation's
 * account type and repository selection).
 *
 * @param {object} integration - The integration.
 * @returns {React.ReactElement|null} The details, or `null` without any.
 */
function renderAccountDetails(integration) {
  const details = IntegrationTypes.detailsOf(integration);

  if (details.length === 0) {
    return null;
  }

  return <div className="small text-muted">{details.join(' · ')}</div>;
}

/**
 * Render the expiring-soon flag when the integration expires within 7 days.
 *
 * @param {{expiresAt: string, status: string}} integration - The integration.
 * @returns {React.ReactElement|null} The flag, or `null` outside the window.
 */
function renderExpiringSoon(integration) {
  if (!IntegrationFormatters.isExpiringSoon(integration)) {
    return null;
  }

  return <span className="badge text-bg-warning ms-1">Expiring soon</span>;
}

/**
 * Render the Expiry cell: the date or "no expiry", plus the expiring-soon flag.
 *
 * @param {{expiresAt: (string|null), status: string}} integration - The integration.
 * @returns {React.ReactElement} The Expiry cell content.
 */
function renderExpiry(integration) {
  if (!integration.expiresAt) {
    return 'no expiry';
  }

  return (
    <>
      {IntegrationFormatters.date(integration.expiresAt)}
      {renderExpiringSoon(integration)}
    </>
  );
}

/**
 * Render the Last tested cell: relative time and result, or "never".
 *
 * @param {{lastTestedAt: (string|null), lastTestResult: (string|null)}} integration - The
 *   integration.
 * @returns {string} The Last tested cell content.
 */
function renderLastTested(integration) {
  if (!integration.lastTestedAt) {
    return 'never';
  }

  const result = TEST_RESULTS.get(integration.lastTestResult) ?? integration.lastTestResult;

  return `${IntegrationFormatters.relative(integration.lastTestedAt)} (${result})`;
}

/**
 * Render one integration row.
 *
 * @param {object} integration - The integration.
 * @param {{rowState: Map, types: Array<object>, sharedLogins: Set<string>}} context - Row UI
 *   state, the available type definitions and shared logins.
 * @param {object} handlers - Page handlers.
 * @returns {React.ReactElement} The row.
 */
function renderRow(integration, context, handlers) {
  return (
    <tr key={integration.id}>
      <td>{integration.label}</td>
      <td>{IntegrationTypes.nameOf(integration.type)}</td>
      <td>
        {integration.githubLogin}
        {renderAccountDetails(integration)}
        {renderSharedLoginHint(integration.githubLogin, context.sharedLogins)}
      </td>
      <td>
        <span className={`badge ${STATUS_BADGES.get(integration.status) ?? 'text-bg-light'}`}>{integration.status}</span>
        {renderStatusDetail(integration)}
      </td>
      <td>{integration.secretHint ?? 'unavailable'}</td>
      <td>{renderExpiry(integration)}</td>
      <td>{renderLastTested(integration)}</td>
      <td>{IntegrationActionsHelper.render(
        integration, context.rowState.get(integration.id) ?? {}, handlers, context.types,
      )}</td>
    </tr>
  );
}

/**
 * Rendering helper for the integrations table.
 */
const IntegrationsTableHelper = {
  /**
   * Render the integrations table.
   *
   * @param {{integrations: Array<object>, rowState: Map, types: Array<object>}} state - Page
   *   state.
   * @param {object} handlers - Page handlers.
   * @returns {React.ReactElement} The table.
   */
  render(state, handlers) {
    const context = {
      rowState: state.rowState,
      types: state.types ?? [],
      sharedLogins: IntegrationFormatters.sharedLogins(state.integrations),
    };

    return (
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Label</th>
            <th>Type</th>
            <th>GitHub account</th>
            <th>Status</th>
            <th>Credential</th>
            <th>Expiry</th>
            <th>Last tested</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {state.integrations.map((integration) => renderRow(integration, context, handlers))}
        </tbody>
      </Table>
    );
  },
};

export default IntegrationsTableHelper;
