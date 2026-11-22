import IssuesEmptyStateHelper from './IssuesEmptyStateHelper.jsx';
import IssuesPaginationHelper from './IssuesPaginationHelper.jsx';
import IssuesTableHelper from './IssuesTableHelper.jsx';
import IssuesToolbarHelper from './IssuesToolbarHelper.jsx';

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
 * @param {object} state - List state.
 * @param {object} handlers - Event handlers.
 * @returns {React.ReactElement} The loaded content.
 */
function renderContent(state, handlers) {
  const { projectId, listing, query, canImport } = state;

  return (
    <>
      {IssuesToolbarHelper.render(projectId, query, handlers)}
      {listing.issues.length > 0
        ? IssuesTableHelper.render(projectId, listing.issues)
        : IssuesEmptyStateHelper.render(projectId, query, { canImport, onImport: handlers.onImport })}
      {IssuesPaginationHelper.render(listing.pagination, handlers)}
    </>
  );
}

/**
 * Render the list's body for the current load state.
 *
 * @param {object} state - List state.
 * @param {object} handlers - Event handlers.
 * @returns {React.ReactElement} The loading message, the error, or the loaded content.
 */
function renderBody(state, handlers) {
  if (state.loadState.loading) {
    return <p>Loading issues…</p>;
  }

  if (state.loadState.error) {
    return renderLoadError(state.loadState.error, handlers);
  }

  return renderContent(state, handlers);
}

/**
 * Rendering helper for a project's issue list.
 */
const IssuesHelper = {
  /**
   * Render the issue list.
   *
   * @param {{projectId: string, listing: object, query: object, loadState: object,
   *   canImport: (boolean|undefined)}} state - List state (`canImport`: the project has a
   *   repository).
   * @param {object} handlers - Event handlers built by `IssuesHandlers`.
   * @returns {React.ReactElement} The rendered list.
   */
  render(state, handlers) {
    return <section aria-label="Issues">{renderBody(state, handlers)}</section>;
  },
};

export default IssuesHelper;
