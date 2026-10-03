const MAX_INSTALLATIONS = 100;

const ACCOUNT_TYPES = new Map([
  ['User', 'User'],
  ['Organization', 'Organization'],
]);

/**
 * Render the "only the first 100" notice when the selection hit the backend's limit.
 *
 * @param {Array<object>} installations - The listed installations.
 * @returns {React.ReactElement|null} The notice, or `null` under the limit.
 */
function renderLimitNotice(installations) {
  if (installations.length !== MAX_INSTALLATIONS) {
    return null;
  }

  return <p className="small text-muted mb-2">Only the first 100 installations are shown.</p>;
}

/**
 * Render one installation entry: its account login, a user/organization marker and a choose
 * button.
 *
 * @param {{installationId: number, accountLogin: string, accountType: string}} installation -
 *   The installation.
 * @param {Function} onSelect - Curried by installation id; returns the click handler.
 * @returns {React.ReactElement} The entry.
 */
function renderInstallation(installation, onSelect) {
  return (
    <li key={installation.installationId} className="list-group-item d-flex justify-content-between align-items-center">
      <span>
        {installation.accountLogin}
        <span className="badge text-bg-secondary ms-2">
          {ACCOUNT_TYPES.get(installation.accountType) ?? installation.accountType}
        </span>
      </span>
      <button type="button" className="btn btn-sm btn-primary" onClick={onSelect(installation.installationId)}>
        {`Choose ${installation.accountLogin}`}
      </button>
    </li>
  );
}

/**
 * GitHub App installation selection: shown when a connect flow found several installations the
 * user can access, so they pick one (see
 * `docs/agents/modules/integrations/github-app.md#selection`).
 *
 * @description Renders nothing without a pending selection. The selection's `state` is never
 * rendered; only the installations are.
 * @param {{selection: ({installations: Array<object>}|null), onSelect: Function,
 *   onCancel: Function}} props - The pending selection, the choose handler (curried by
 *   installation id) and the cancel handler (drops the selection).
 * @returns {React.ReactElement|null} The selection card, or `null` without a selection.
 */
export default function GithubAppSelection({ selection, onSelect, onCancel }) {
  if (!selection) {
    return null;
  }

  const installations = selection.installations ?? [];

  return (
    <div className="card card-body mb-3">
      <h2 className="h5">Choose a GitHub App installation</h2>
      <p className="small mb-2">Your GitHub account can access several installations of Kerghan&apos;s GitHub App. Pick the one to connect.</p>
      {renderLimitNotice(installations)}
      <ul className="list-group mb-2">
        {installations.map((installation) => renderInstallation(installation, onSelect))}
      </ul>
      <div>
        <button type="button" className="btn btn-link" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
