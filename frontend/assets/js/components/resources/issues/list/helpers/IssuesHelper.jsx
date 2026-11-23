import Alert from 'react-bootstrap/cjs/Alert.js';
import { INITIAL_BULK } from '../controllers/BulkSelectionController.js';
import IssuesBulkBarHelper from './IssuesBulkBarHelper.jsx';
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
 * Render the bulk summary notice, shown only when there is one. It is text, never HTML.
 *
 * @param {(string|null)} notice - The summary sentence.
 * @param {{onDismissNotice: Function}} handlers - Event handlers.
 * @returns {React.ReactElement|null} The dismissible alert, or `null` without a notice.
 */
function renderNotice(notice, handlers) {
  if (notice === null) {
    return null;
  }

  return <Alert variant="success" dismissible onClose={handlers.onDismissNotice}>{notice}</Alert>;
}

/**
 * Render the rows (with the bulk bar) or, when the list has none, the empty state.
 *
 * @param {object} state - List state.
 * @param {object} handlers - Event handlers.
 * @returns {React.ReactElement} The rows block or the empty state.
 */
function renderRows(state, handlers) {
  const { projectId, listing, query, canImport } = state;
  const bulk = state.bulk ?? INITIAL_BULK;

  if (listing.issues.length === 0) {
    return IssuesEmptyStateHelper.render(projectId, query, { canImport, onImport: handlers.onImport });
  }

  return (
    <>
      {IssuesBulkBarHelper.render(bulk, handlers)}
      {IssuesTableHelper.render(projectId, listing.issues, {
        selected: bulk.selected, onToggle: handlers.onToggle, onToggleAll: handlers.onToggleAll,
      })}
    </>
  );
}

/**
 * Render the loaded content: toolbar, notice, rows or empty state, and pagination.
 *
 * @param {object} state - List state.
 * @param {object} handlers - Event handlers.
 * @returns {React.ReactElement} The loaded content.
 */
function renderContent(state, handlers) {
  const { projectId, listing, query } = state;

  return (
    <>
      {IssuesToolbarHelper.render(projectId, query, handlers)}
      {renderNotice((state.bulk ?? INITIAL_BULK).notice, handlers)}
      {renderRows(state, handlers)}
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
   *   canImport: (boolean|undefined), bulk: (object|undefined)}} state - List state
   *   (`canImport`: the project has a repository; `bulk`: the bulk selection state).
   * @param {object} handlers - Event handlers built by `IssuesHandlers`.
   * @returns {React.ReactElement} The rendered list.
   */
  render(state, handlers) {
    return <section aria-label="Issues">{renderBody(state, handlers)}</section>;
  },
};

export default IssuesHelper;
