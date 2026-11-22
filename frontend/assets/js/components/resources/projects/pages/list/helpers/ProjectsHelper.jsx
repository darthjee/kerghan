import ProjectsEmptyStateHelper from './ProjectsEmptyStateHelper.jsx';
import ProjectsPaginationHelper from './ProjectsPaginationHelper.jsx';
import ProjectsTableHelper from './ProjectsTableHelper.jsx';
import ProjectsToolbarHelper from './ProjectsToolbarHelper.jsx';

/**
 * Render the one-time notice (e.g. after a deletion), shown only when there is one.
 *
 * @param {(string[]|null)} notice - The notice's lines.
 * @returns {React.ReactElement|null} The notice, or `null` without one.
 */
function renderNotice(notice) {
  if (notice === null) {
    return null;
  }

  return (
    <div className="alert alert-success" role="status">
      {notice.map((line) => <div key={line}>{line}</div>)}
    </div>
  );
}

/**
 * Render the load error with a retry action.
 *
 * @param {string} error - The load error message.
 * @param {{onRetry: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The error block.
 */
function renderLoadError(error, handlers) {
  return (
    <div className="alert alert-danger" role="alert">
      {error}
      <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={handlers.onRetry}>
        Retry
      </button>
    </div>
  );
}

/**
 * Render the loaded content: toolbar, rows or empty state, and pagination.
 *
 * @param {object} state - Page state.
 * @param {object} handlers - Event handlers.
 * @returns {React.ReactElement} The loaded content.
 */
function renderContent(state, handlers) {
  const { listing, query } = state;

  return (
    <>
      {ProjectsToolbarHelper.render(query, handlers)}
      {listing.projects.length > 0
        ? ProjectsTableHelper.render(listing.projects)
        : ProjectsEmptyStateHelper.render(query)}
      {ProjectsPaginationHelper.render(listing.pagination, handlers)}
    </>
  );
}

/**
 * Render the page body for the current load state.
 *
 * @param {object} state - Page state.
 * @param {object} handlers - Event handlers.
 * @returns {React.ReactElement} The loading message, the error, or the loaded content.
 */
function renderBody(state, handlers) {
  if (state.loadState.loading) {
    return <p>Loading projects…</p>;
  }

  if (state.loadState.error) {
    return renderLoadError(state.loadState.error, handlers);
  }

  return renderContent(state, handlers);
}

/**
 * Rendering helper for the project list page.
 */
const ProjectsHelper = {
  /**
   * Render the project list page.
   *
   * @param {{listing: object, query: object, loadState: object, notice: (string[]|null)}}
   *   state - Page state.
   * @param {object} handlers - Event handlers built by `ProjectsHandlers`.
   * @returns {React.ReactElement} The rendered page.
   */
  render(state, handlers) {
    return (
      <div className="container mt-4">
        <h1>Projects</h1>
        {renderNotice(state.notice)}
        {renderBody(state, handlers)}
      </div>
    );
  },
};

export default ProjectsHelper;
