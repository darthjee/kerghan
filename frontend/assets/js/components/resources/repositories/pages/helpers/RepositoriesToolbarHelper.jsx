import Formatters from '../repositories/formatters.js';

const FILTERS = [
  ['all', 'All'],
  ['added', 'Added'],
  ['not_added', 'Not added'],
  ['unavailable', 'Unavailable'],
];

/**
 * Describe the Refresh button for the current sync and cooldown.
 *
 * @param {{sync: object, now: number, cooldownUntil: (number|null)}} state - Page state.
 * @returns {{label: string, disabled: boolean, hint: (string|undefined)}} The button's label,
 *   disabled flag and tooltip / accessible label.
 */
function refreshButton({ sync, now, cooldownUntil }) {
  if (sync.state === 'syncing') {
    return { label: 'Syncing…', disabled: true };
  }

  if (cooldownUntil !== null && cooldownUntil > now) {
    return {
      label: 'Refresh',
      disabled: true,
      hint: `Refresh available in ${Formatters.countdown(cooldownUntil - now)}`,
    };
  }

  return { label: 'Refresh', disabled: false };
}

/**
 * Render the Refresh button.
 *
 * @param {object} state - Page state.
 * @param {{onRefresh: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The button.
 */
function renderRefresh(state, handlers) {
  const { label, disabled, hint } = refreshButton(state);

  return (
    <button
      type="button"
      className="btn btn-outline-primary"
      disabled={disabled}
      title={hint}
      aria-label={hint}
      onClick={handlers.onRefresh}
    >
      {label}
    </button>
  );
}

/**
 * Render the "last synced X ago" label.
 *
 * @param {{lastSyncedAt: (string|null)}} sync - The sync-state object.
 * @param {number} now - Current epoch milliseconds.
 * @returns {React.ReactElement|null} The label, or `null` before the first sync.
 */
function renderLastSynced(sync, now) {
  if (!sync.lastSyncedAt) {
    return null;
  }

  return <span className="text-muted small">Last synced {Formatters.ago(sync.lastSyncedAt, now)}</span>;
}

/**
 * Render the Refresh `429` notice.
 *
 * @param {string|null} notice - The notice text.
 * @returns {React.ReactElement|null} The notice, or `null` without one.
 */
function renderNotice(notice) {
  return notice ? <div className="alert alert-warning mt-2" role="status">{notice}</div> : null;
}

/**
 * Rendering helper for the Repositories toolbar: filter, search, Refresh and last-synced label.
 */
const RepositoriesToolbarHelper = {
  /**
   * Render the toolbar.
   *
   * @param {{sync: object, query: object, now: number, cooldownUntil: (number|null),
   *   refreshNotice: (string|null)}} state - Page state.
   * @param {{onFilterChange: Function, onSearchChange: Function, onRefresh: Function}} handlers
   *   - Event handlers.
   * @returns {React.ReactElement} The toolbar.
   */
  render(state, handlers) {
    return (
      <div className="mb-3">
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <select
            className="form-select w-auto"
            aria-label="Filter"
            value={state.query.filter}
            onChange={handlers.onFilterChange}
          >
            {FILTERS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
          <input
            type="search"
            className="form-control w-auto"
            aria-label="Search repositories"
            placeholder="Search by name"
            value={state.query.search}
            onChange={handlers.onSearchChange}
          />
          {renderRefresh(state, handlers)}
          {renderLastSynced(state.sync, state.now)}
        </div>
        {renderNotice(state.refreshNotice)}
      </div>
    );
  },
};

export default RepositoriesToolbarHelper;
