import ProjectPaths from '../../../projects/paths.js';

/**
 * Rendering helper for the issue list's toolbar: the state filter, the title search and
 * "New issue".
 */
const IssuesToolbarHelper = {
  /**
   * Render the toolbar.
   *
   * @param {string} projectId - The project's uuid.
   * @param {{state: string, search: string}} query - The current query.
   * @param {{onSearchChange: Function, onStateChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The toolbar.
   */
  render(projectId, query, handlers) {
    return (
      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <select
          className="form-select w-auto"
          aria-label="Filter by state"
          value={query.state}
          onChange={handlers.onStateChange}
        >
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="all">All</option>
        </select>
        <input
          type="search"
          className="form-control w-auto"
          aria-label="Search issues"
          placeholder="Search by title"
          maxLength={100}
          value={query.search}
          onChange={handlers.onSearchChange}
        />
        <a className="btn btn-primary ms-auto" href={ProjectPaths.newIssue(projectId)}>New issue</a>
      </div>
    );
  },
};

export default IssuesToolbarHelper;
