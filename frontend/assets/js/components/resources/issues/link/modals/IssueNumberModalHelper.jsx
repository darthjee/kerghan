import Modal from 'react-bootstrap/cjs/Modal.js';
import DescribedError from '../../../projects/DescribedError.jsx';

/**
 * Render the in-modal error, shown only after a refusal.
 *
 * @param {(object|null)} error - The described error.
 * @returns {React.ReactElement|null} The alert, or `null`.
 */
function renderError(error) {
  return error === null ? null : <DescribedError error={error} className="alert alert-danger mt-3 mb-0" role="alert" />;
}

/**
 * Label of the submit button: the countdown while a rate limit runs, else its own name.
 *
 * @param {{submitLabel: string, countdown: {active: boolean, label: (string|null)}}} state -
 *   Modal state.
 * @returns {string} The label.
 */
function submitText(state) {
  return state.countdown.active ? state.countdown.label : state.submitLabel;
}

/**
 * Rendering helper of the shared issue-number modal (a react-bootstrap `Modal`).
 */
const IssueNumberModalHelper = {
  /**
   * Render the modal: one input, the error, Cancel first and the submit on its right.
   *
   * @param {{title: string, submitLabel: string, value: string, pending: boolean,
   *   error: (object|null), countdown: {active: boolean, label: (string|null)}}} state - Modal
   *   state.
   * @param {{onChange: Function, onSubmit: Function, onCancel: Function}} handlers - Event
   *   handlers.
   * @returns {React.ReactElement} The modal.
   */
  render(state, handlers) {
    return (
      <Modal show onHide={state.pending ? undefined : handlers.onCancel} backdrop={state.pending ? 'static' : true}>
        <form onSubmit={handlers.onSubmit} noValidate>
          <Modal.Header closeButton={!state.pending}>
            <Modal.Title>{state.title}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <label className="form-label" htmlFor="issue-number-input">GitHub issue</label>
            <input
              id="issue-number-input"
              className="form-control"
              type="text"
              autoComplete="off"
              autoFocus
              placeholder="12, #12 or an issue URL"
              value={state.value}
              disabled={state.pending}
              onChange={handlers.onChange}
            />
            {renderError(state.error)}
          </Modal.Body>
          <Modal.Footer>
            <button type="button" className="btn btn-secondary" disabled={state.pending} onClick={handlers.onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={state.pending || state.countdown.active}>
              {state.pending ? <span className="spinner-border spinner-border-sm me-1" role="status" aria-label="Working" /> : null}
              {submitText(state)}
            </button>
          </Modal.Footer>
        </form>
      </Modal>
    );
  },
};

export default IssueNumberModalHelper;
