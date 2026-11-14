import RepositoriesEmptyStateHelper from './RepositoriesEmptyStateHelper.jsx';
import RepositoriesPaginationHelper from './RepositoriesPaginationHelper.jsx';
import RepositoriesTableHelper from './RepositoriesTableHelper.jsx';
import RepositoriesToolbarHelper from './RepositoriesToolbarHelper.jsx';
import SourceBannersHelper from './SourceBannersHelper.jsx';

/**
 * Render the sync indicator: a full spinner for the very first sync, a small line otherwise.
 *
 * @param {{state: string, lastSyncedAt: (string|null)}} sync - The sync-state object.
 * @returns {React.ReactElement|null} The spinner, the indicator, or `null` while idle.
 */
function renderSyncIndicator(sync) {
  if (sync.state !== 'syncing') {
    return null;
  }

  if (sync.lastSyncedAt === null) {
    return (
      <div className="text-center my-5" role="status">
        <div className="spinner-border" aria-hidden="true" />
        <p className="mt-2">Syncing with GitHub for the first time…</p>
      </div>
    );
  }

  return <p className="text-muted small" role="status">Syncing with GitHub…</p>;
}

/**
 * Render the rows, or the empty state. Nothing while a sync runs with no rows to show.
 *
 * @param {object} state - Page state.
 * @param {object} handlers - Event handlers.
 * @returns {React.ReactElement|null} The table, the empty state, or `null`.
 */
function renderRows(state, handlers) {
  const { sync, listing, query } = state;

  if (sync.state === 'syncing' && sync.lastSyncedAt === null) {
    return null;
  }

  if (listing.repositories.length > 0) {
    return RepositoriesTableHelper.render(state, handlers);
  }

  return sync.state === 'syncing' ? null : RepositoriesEmptyStateHelper.render(sync, query);
}

/**
 * Render the loaded content: banners, toolbar, sync indicator, rows and pagination.
 *
 * @param {object} state - Page state.
 * @param {object} handlers - Event handlers.
 * @returns {React.ReactElement} The loaded content.
 */
function renderContent(state, handlers) {
  return (
    <>
      {SourceBannersHelper.render(state.sync, state.dismissed, handlers)}
      {RepositoriesToolbarHelper.render(state, handlers)}
      {renderSyncIndicator(state.sync)}
      {renderRows(state, handlers)}
      {RepositoriesPaginationHelper.render(state.listing.pagination, handlers)}
    </>
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
    <div className="alert alert-danger">
      {error}
      <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={handlers.onRetry}>
        Retry
      </button>
    </div>
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
    return <p>Loading repositories…</p>;
  }

  if (state.loadState.error) {
    return renderLoadError(state.loadState.error, handlers);
  }

  return renderContent(state, handlers);
}

/**
 * Rendering helper for the Repositories page.
 */
const RepositoriesHelper = {
  /**
   * Render the Repositories page.
   *
   * @param {{listing: object, sync: (object|null), query: object, loadState: object,
   *   addState: Map, dismissed: Set<string>, refreshNotice: (string|null), now: number,
   *   cooldownUntil: (number|null)}} state - Page state.
   * @param {object} handlers - Event handlers built by `RepositoriesHandlers`.
   * @returns {React.ReactElement} The rendered Repositories page.
   */
  render(state, handlers) {
    return (
      <div className="container mt-4">
        <h1>Repositories</h1>
        {renderBody(state, handlers)}
      </div>
    );
  },
};

export default RepositoriesHelper;
