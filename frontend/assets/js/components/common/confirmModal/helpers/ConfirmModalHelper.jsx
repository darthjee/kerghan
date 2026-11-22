import Modal from 'react-bootstrap/cjs/Modal.js';
import ConfirmModalController from '../controllers/ConfirmModalController.js';

/**
 * Render the typed-confirmation field, shown only when a text must be typed.
 *
 * @param {{typeToConfirm: (string|undefined), typed: string, pending: boolean}} state - Modal
 *   state.
 * @param {{onTypedChange: Function}} handlers - Event handlers.
 * @returns {React.ReactElement|null} The field, or `null` when no text is required.
 */
function renderTyped(state, handlers) {
  if (state.typeToConfirm === undefined) {
    return null;
  }

  return (
    <div className="mt-3">
      <label className="form-label" htmlFor="confirm-modal-typed">
        {`Type "${state.typeToConfirm}" to confirm`}
      </label>
      <input
        id="confirm-modal-typed"
        className="form-control"
        type="text"
        autoComplete="off"
        value={state.typed}
        disabled={state.pending}
        onChange={handlers.onTypedChange}
      />
    </div>
  );
}

/**
 * Render the error of the confirmed call, shown only after a rejection.
 *
 * @param {(string|null)} error - The error message.
 * @returns {React.ReactElement|null} The alert, or `null` without an error.
 */
function renderError(error) {
  return error === null ? null : <div className="alert alert-danger mt-3 mb-0" role="alert">{error}</div>;
}

/**
 * Render the Confirm button: on the right, red when destructive, with a spinner in flight.
 *
 * @param {object} state - Modal state.
 * @param {{onConfirm: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The button.
 */
function renderConfirm(state, handlers) {
  const allowed = ConfirmModalController.isConfirmed(state.typeToConfirm, state.typed);

  return (
    <button
      type="button"
      className={`btn ${state.danger ? 'btn-danger' : 'btn-primary'}`}
      disabled={state.pending || !allowed}
      onClick={handlers.onConfirm}
    >
      {state.pending ? <span className="spinner-border spinner-border-sm me-1" role="status" aria-label="Working" /> : null}
      {state.confirmLabel}
    </button>
  );
}

/**
 * Rendering helper of the shared confirmation modal (a react-bootstrap `Modal`).
 */
const ConfirmModalHelper = {
  /**
   * Render the modal. Cancel takes the initial focus (so Enter never confirms), and Confirm is
   * on its right.
   *
   * @param {{title: string, message: string, confirmLabel: string, danger: boolean,
   *   typeToConfirm: (string|undefined), typed: string, pending: boolean,
   *   error: (string|null)}} state - Modal state.
   * @param {{onCancel: Function, onConfirm: Function, onTypedChange: Function}} handlers -
   *   Event handlers.
   * @returns {React.ReactElement} The rendered modal.
   */
  render(state, handlers) {
    return (
      <Modal show onHide={state.pending ? undefined : handlers.onCancel} backdrop={state.pending ? 'static' : true}>
        <Modal.Header closeButton={!state.pending}>
          <Modal.Title>{state.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">{state.message}</p>
          {renderTyped(state, handlers)}
          {renderError(state.error)}
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            className="btn btn-secondary"
            autoFocus
            disabled={state.pending}
            onClick={handlers.onCancel}
          >
            Cancel
          </button>
          {renderConfirm(state, handlers)}
        </Modal.Footer>
      </Modal>
    );
  },
};

export default ConfirmModalHelper;
