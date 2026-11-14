/**
 * Render the explanation shown with no GitHub handle and no integration.
 *
 * @returns {React.ReactElement} The no-source state.
 */
function renderNoSource() {
  return (
    <div className="alert alert-info">
      <p className="mb-1">Kerghan has no way to list your repositories yet. You can either:</p>
      <ul className="mb-0">
        <li>
          set your GitHub handle on your <a href="#/account/my-account">Account</a> page, to list
          your public repositories; or
        </li>
        <li>
          add a GitHub credential in <a href="#/account/integrations">Integrations</a>, to list
          the repositories it can see, including private ones.
        </li>
      </ul>
    </div>
  );
}

/**
 * Rendering helper for the Repositories page's empty states.
 */
const RepositoriesEmptyStateHelper = {
  /**
   * Render the empty state matching why there are no rows.
   *
   * @param {{sources: Array<object>}} sync - The sync-state object.
   * @param {{filter: string, search: string}} query - The current query.
   * @returns {React.ReactElement} The no-source state, the no-match message, or the
   *   no-repositories message.
   */
  render(sync, query) {
    if (sync.sources.length === 0) {
      return renderNoSource();
    }

    if (query.filter !== 'all' || query.search !== '') {
      return <p>No repositories match your filters.</p>;
    }

    return <p>No repositories found. Check the sources above.</p>;
  },
};

export default RepositoriesEmptyStateHelper;
