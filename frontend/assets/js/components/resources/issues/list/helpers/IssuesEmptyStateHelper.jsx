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
 * Rendering helper for the issue list's empty states.
 */
const IssuesEmptyStateHelper = {
  /**
   * Render the empty state matching why there are no rows.
   *
   * @param {string} projectId - The project's uuid.
   * @param {{state: string, search: string}} query - The current query.
   * @returns {React.ReactElement} The no-match message (search echoed as text), "No closed
   *   issues.", "No open issues." with "New issue", or "This project has no issues yet." with
   *   "New issue".
   */
  render(projectId, query) {
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
      </div>
    );
  },
};

export default IssuesEmptyStateHelper;
