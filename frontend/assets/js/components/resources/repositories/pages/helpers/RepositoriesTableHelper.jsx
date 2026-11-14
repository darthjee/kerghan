import Table from 'react-bootstrap/cjs/Table.js';
import Formatters from '../repositories/formatters.js';
import SourceKeys from '../repositories/sourceKeys.js';

const STATUS_LABELS = new Map([
  ['added', 'Added'],
  ['not_added', 'Not added'],
  ['unavailable', 'Unavailable'],
  ['unknown', 'Unknown'],
]);

const HEALTHY_STATUSES = new Set(['ok', 'page_cap_reached']);

/**
 * Describe the health of a row source from the sync state.
 *
 * @param {object} source - A row's source entry.
 * @param {Array<object>} syncSources - The sync-state sources.
 * @returns {{muted: boolean, hint: (string|undefined)}} Whether to mute the badge, and the
 *   tooltip / accessible label.
 */
function sourceHealth(source, syncSources) {
  const key = SourceKeys.keyOf(source);
  const status = syncSources.find((candidate) => SourceKeys.keyOf(candidate) === key)?.status;
  const name = source.kind === 'integration' ? source.integration.label : source.handle;

  if (status === 'pending') {
    return { muted: true, hint: `${name} has not been synced yet` };
  }

  if (status === undefined || HEALTHY_STATUSES.has(status)) {
    return { muted: false };
  }

  return { muted: true, hint: `${name} could not be refreshed` };
}

/**
 * Render a row's source badges.
 *
 * @param {Array<object>} sources - The row's sources.
 * @param {Array<object>} syncSources - The sync-state sources.
 * @returns {React.ReactElement} The badges.
 */
function renderSources(sources, syncSources) {
  return (
    <>
      {sources.map((source) => {
        const { muted, hint } = sourceHealth(source, syncSources);
        const name = source.kind === 'integration' ? source.integration.label : source.handle;

        return (
          <span
            key={SourceKeys.keyOf(source)}
            className={`badge me-1 ${muted ? 'text-bg-secondary opacity-50' : 'text-bg-info'}`}
            title={hint}
            aria-label={hint}
          >
            {name}
          </span>
        );
      })}
    </>
  );
}

/**
 * Render the inline Add error of a row.
 *
 * @param {{message: string, link: ({href: string, text: string}|undefined)}} error - The error.
 * @returns {React.ReactElement} The error.
 */
function renderAddError(error) {
  return (
    <div className="text-danger small" role="alert">
      {error.message}
      {error.link ? <> <a href={error.link.href}>{error.link.text}</a>.</> : null}
    </div>
  );
}

/**
 * Render the Add button, its spinner while running, and its inline error.
 *
 * @param {object} repository - The row.
 * @param {{status: string, message: string, link: (object|undefined)}|undefined} addState -
 *   The row's Add state.
 * @param {{onAdd: Function}} handlers - Event handlers.
 * @returns {React.ReactElement|null} The Add cell content, or `null` for a non-addable row.
 */
function renderAdd(repository, addState, handlers) {
  if (repository.status !== 'not_added') {
    return null;
  }

  const pending = addState?.status === 'pending';

  return (
    <>
      <button
        type="button"
        className="btn btn-sm btn-outline-success"
        disabled={pending}
        onClick={handlers.onAdd(repository.githubId)}
      >
        {pending ? <span className="spinner-border spinner-border-sm me-1" role="status" aria-label="Adding" /> : null}
        Add
      </button>
      {addState?.status === 'error' ? renderAddError(addState) : null}
    </>
  );
}

/**
 * Render one repository row.
 *
 * @param {object} repository - The row.
 * @param {{sync: object, addState: Map}} state - Page state.
 * @param {object} handlers - Event handlers.
 * @returns {React.ReactElement} The table row.
 */
function renderRow(repository, state, handlers) {
  return (
    <tr key={repository.githubId}>
      <td>
        <a
          href={Formatters.githubUrl(repository.owner, repository.name)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {repository.fullName}
        </a>
      </td>
      <td>
        <span className={`badge ${repository.private ? 'text-bg-dark' : 'text-bg-light border'}`}>
          {repository.private ? 'Private' : 'Public'}
        </span>
      </td>
      <td>{renderSources(repository.sources, state.sync.sources)}</td>
      <td>{STATUS_LABELS.get(repository.status) ?? repository.status}</td>
      <td>{renderAdd(repository, state.addState.get(repository.githubId), handlers)}</td>
    </tr>
  );
}

/**
 * Rendering helper for the repositories table.
 */
const RepositoriesTableHelper = {
  /**
   * Render the table of repositories.
   *
   * @param {{listing: {repositories: Array<object>}, sync: object, addState: Map}} state - Page
   *   state.
   * @param {{onAdd: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The table.
   */
  render(state, handlers) {
    return (
      <Table responsive hover>
        <thead>
          <tr>
            <th>Repository</th>
            <th>Visibility</th>
            <th>Sources</th>
            <th>Status</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {state.listing.repositories.map((repository) => renderRow(repository, state, handlers))}
        </tbody>
      </Table>
    );
  },
};

export default RepositoriesTableHelper;
