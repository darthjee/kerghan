import ProjectPaths from '../../../projects/paths.js';

/**
 * Render the "New issue" call to action.
 *
 * @param {string} projectId - The project's uuid.
 * @returns {React.ReactElement} The action.
 */
function renderNewIssue(projectId) {
  return <a className="btn btn-primary" href={ProjectPaths.newIssue(projectId)}>New issue</a>;
}

/**
 * Render the "Import from GitHub" call to action, shown only when the project has a repository.
 *
 * @param {{canImport: (boolean|undefined), onImport: (Function|undefined)}} importEntry - Whether
 *   importing is possible, and the callback opening the import modal.
 * @returns {React.ReactElement|null} The button, or `null` without a repository.
 */
function renderImport(importEntry) {
  if (!importEntry.canImport) {
    return null;
  }

  return (
    <button type="button" className="btn btn-outline-primary ms-2" onClick={importEntry.onImport}>
      Import from GitHub
    </button>
  );
}

/**
 * Rendering helper for the issue list's empty states.
 */
const IssuesEmptyStateHelper = {
  /**
   * Render the empty state matching why there are no rows.
   *
   * @param {string} projectId - The project's uuid.
   * @param {{state: string, search: string}} query - The current query.
   * @param {{canImport: (boolean|undefined), onImport: (Function|undefined)}} [importEntry] -
   *   Whether the project has a repository (then Open and All also offer "Import from GitHub"),
   *   and the callback opening the import modal.
   * @returns {React.ReactElement} The no-match message (search echoed as text), "No closed
   *   issues.", "No open issues." with "New issue" (and "Import from GitHub"), or "This project
   *   has no issues yet." with the same actions.
   */
  render(projectId, query, importEntry = {}) {
    if (query.search !== '') {
      return <p>{`No issues match "${query.search}".`}</p>;
    }

    if (query.state === 'closed') {
      return <p>No closed issues.</p>;
    }

    return (
      <div className="text-center my-5">
        <p>{query.state === 'open' ? 'No open issues.' : 'This project has no issues yet.'}</p>
        {renderNewIssue(projectId)}
        {renderImport(importEntry)}
      </div>
    );
  },
};

export default IssuesEmptyStateHelper;
