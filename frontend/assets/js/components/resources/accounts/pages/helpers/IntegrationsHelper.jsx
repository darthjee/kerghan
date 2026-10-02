/**
 * Render the load state (loading message or error with a retry action), if any.
 *
 * @param {{loading: boolean, error: (string|null)}} loadState - The page's load state.
 * @param {{onRetry: Function}} handlers - Event handlers.
 * @returns {React.ReactElement|null} The load state block, or `null` once loaded.
 */
function renderLoadState(loadState, handlers) {
  if (loadState.loading) {
    return <p>Loading integrations…</p>;
  }

  if (!loadState.error) {
    return null;
  }

  return (
    <div className="alert alert-danger">
      {loadState.error}
      <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={handlers.onRetry}>
        Retry
      </button>
    </div>
  );
}

/**
 * Rendering helper for the "My account → Integrations" page.
 */
const IntegrationsHelper = {
  /**
   * Render the Integrations page.
   *
   * @param {{integrations: Array<object>, types: Array<object>, loadState: object,
   *   rowState: Map, addForm: object}} state - Page state.
   * @param {object} handlers - Event handlers built by `IntegrationsHandlers`.
   * @returns {React.ReactElement} The rendered Integrations page.
   */
  render(state, handlers) {
    return (
      <div className="container mt-4">
        <h1>Integrations</h1>
        {renderLoadState(state.loadState, handlers)}
      </div>
    );
  },
};

export default IntegrationsHelper;
