/**
 * Render the chosen repository with its Clear button.
 *
 * @param {{fullName: string}} selected - The chosen repository.
 * @param {{onClear: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The chosen repository.
 */
function renderSelected(selected, handlers) {
  return (
    <div className="d-flex align-items-center gap-2">
      <span style={{ overflowWrap: 'anywhere' }}>{selected.fullName}</span>
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handlers.onClear}>
        Clear
      </button>
    </div>
  );
}

/**
 * Render the hint shown when the user has no added repository at all.
 *
 * @returns {React.ReactElement} The default "No repository" and the hint.
 */
function renderNoneAdded() {
  return (
    <div>
      <span className="text-muted">No repository</span>
      {' '}
      <a href="#/repositories">Add a repository first</a>
    </div>
  );
}

/**
 * Render the search results as a list of pickable repositories.
 *
 * @param {{results: Array<object>, search: string}} state - Picker state.
 * @param {{onPick: Function}} handlers - Event handlers.
 * @returns {React.ReactElement|null} The list, the no-match message for a search, or `null`
 *   when there is nothing to show.
 */
function renderResults(state, handlers) {
  if (state.results.length === 0) {
    return state.search === ''
      ? null
      : <p className="text-muted small mb-0">{`No added repositories match "${state.search}".`}</p>;
  }

  return (
    <div className="list-group mt-1">
      {state.results.map((repository) => (
        <button
          key={repository.githubId}
          type="button"
          className="list-group-item list-group-item-action"
          style={{ overflowWrap: 'anywhere' }}
          onClick={handlers.onPick(repository)}
        >
          {repository.fullName}
        </button>
      ))}
    </div>
  );
}

/**
 * Render the search box and its results.
 *
 * @param {object} state - Picker state.
 * @param {object} handlers - Event handlers.
 * @param {string} inputId - The search box's id.
 * @returns {React.ReactElement} The search box with its results and load error.
 */
function renderSearch(state, handlers, inputId) {
  return (
    <div>
      <input
        id={inputId}
        type="search"
        className="form-control"
        aria-label="Search your added repositories"
        placeholder="No repository. Search your added repositories"
        maxLength={100}
        value={state.search}
        onChange={handlers.onSearchChange}
      />
      {state.error ? <div className="text-danger small" role="alert">{state.error}</div> : null}
      {renderResults(state, handlers)}
    </div>
  );
}

/**
 * Rendering helper of the repository picker.
 */
const RepositoryPickerHelper = {
  /**
   * Render the picker: the chosen repository with Clear, the "Add a repository first" hint, or
   * the search box with its results.
   *
   * @param {{selected: ({fullName: string}|null), search: string, results: Array<object>,
   *   noneAdded: boolean, error: (string|null)}} state - Picker state.
   * @param {{onClear: Function, onPick: Function, onSearchChange: Function}} handlers -
   *   Event handlers.
   * @param {string} [inputId] - The search box's id, for its label.
   * @returns {React.ReactElement} The rendered picker.
   */
  render(state, handlers, inputId = 'repository-picker') {
    if (state.selected) {
      return renderSelected(state.selected, handlers);
    }

    return state.noneAdded ? renderNoneAdded() : renderSearch(state, handlers, inputId);
  },
};

export default RepositoryPickerHelper;
