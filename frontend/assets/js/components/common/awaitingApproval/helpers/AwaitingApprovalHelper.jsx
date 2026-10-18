import Container from 'react-bootstrap/cjs/Container.js';

/**
 * Render the view's error alert, if any.
 *
 * @param {{error: (string|null)}} state - View state.
 * @returns {React.ReactElement|null} The error alert, or `null` when there is none.
 */
function renderError(state) {
  if (!state.error) {
    return null;
  }

  return <div className="alert alert-danger">{state.error}</div>;
}

/**
 * Rendering helper for the awaiting-approval view.
 */
const AwaitingApprovalHelper = {
  /**
   * Render the full-page awaiting-approval view.
   *
   * @param {{error: (string|null)}} state - View state.
   * @param {{onCheckAgain: Function, onLogout: Function}} handlers - Click handlers for the
   *   "Check again" and "Log out" actions.
   * @returns {React.ReactElement} The rendered view.
   */
  render(state, handlers) {
    return (
      <Container className="awaiting-approval py-5 text-center">
        <h1 className="h3">Awaiting approval</h1>
        <p>Your account is waiting for an administrator&apos;s approval.</p>
        {renderError(state)}
        <div className="d-flex justify-content-center gap-2">
          <button type="button" className="btn btn-primary" onClick={handlers.onCheckAgain}>
            Check again
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={handlers.onLogout}>
            Log out
          </button>
        </div>
      </Container>
    );
  },
};

export default AwaitingApprovalHelper;
