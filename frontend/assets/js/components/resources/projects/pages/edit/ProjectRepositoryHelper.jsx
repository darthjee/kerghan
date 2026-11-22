import ConfirmModal from '../../../../common/confirmModal/ConfirmModal.jsx';
import DescribedError from '../../DescribedError.jsx';
import RepositoryLabel from '../../RepositoryLabel.jsx';
import RepositoryPicker from '../../repositoryPicker/RepositoryPicker.jsx';

/**
 * Render the Detach confirmation, shown only while it is open.
 *
 * @param {boolean} open - Whether the confirmation is open.
 * @param {{onDetach: Function, onCancelDetach: Function}} handlers - Event handlers.
 * @returns {React.ReactElement|null} The modal, or `null` while closed.
 */
function renderDetachConfirm(open, handlers) {
  if (!open) {
    return null;
  }

  return (
    <ConfirmModal
      title="Detach repository"
      message="The project will have no repository. Its issues are kept."
      confirmLabel="Detach"
      danger
      onConfirm={handlers.onDetach}
      onCancel={handlers.onCancelDetach}
    />
  );
}

/**
 * Render the picker with its Cancel, shown while the user is choosing a repository.
 *
 * @param {{pending: boolean}} state - Section state.
 * @param {{onPick: Function, onClosePicker: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The picker.
 */
function renderPicker(state, handlers) {
  return (
    <div className="mb-2">
      <RepositoryPicker selected={null} onChange={handlers.onPick} inputId="project-repository-picker" />
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary mt-2"
        disabled={state.pending}
        onClick={handlers.onClosePicker}
      >
        Cancel
      </button>
    </div>
  );
}

/**
 * Render the Change / Connect and Detach actions.
 *
 * @param {{repository: (object|null), pending: boolean}} state - Section state.
 * @param {{onOpenPicker: Function, onConfirmDetach: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The actions. The buttons are never pre-disabled by a guess
 *   about links; only an in-flight call disables them (U2).
 */
function renderActions(state, handlers) {
  return (
    <div className="d-flex gap-2">
      <button type="button" className="btn btn-outline-primary" disabled={state.pending} onClick={handlers.onOpenPicker}>
        {state.repository ? 'Change' : 'Connect a repository'}
      </button>
      {state.repository ? (
        <button type="button" className="btn btn-outline-danger" disabled={state.pending} onClick={handlers.onConfirmDetach}>
          Detach
        </button>
      ) : null}
    </div>
  );
}

/**
 * Rendering helper of the repository section of project management.
 */
const ProjectRepositoryHelper = {
  /**
   * Render the section: the current repository, its actions, the picker while choosing, the
   * section's error and the Detach confirmation.
   *
   * @param {{repository: (object|null), picking: boolean, confirmingDetach: boolean,
   *   pending: boolean, error: (object|null)}} state - Section state.
   * @param {{onOpenPicker: Function, onClosePicker: Function, onPick: Function,
   *   onConfirmDetach: Function, onDetach: Function, onCancelDetach: Function}} handlers -
   *   Event handlers.
   * @returns {React.ReactElement} The section.
   */
  render(state, handlers) {
    return (
      <section className="mb-5">
        <h2 className="h4">Repository</h2>
        <p><RepositoryLabel repository={state.repository} /></p>
        {state.error ? <DescribedError error={state.error} className="alert alert-danger" role="alert" /> : null}
        {state.picking ? renderPicker(state, handlers) : renderActions(state, handlers)}
        {renderDetachConfirm(state.confirmingDetach, handlers)}
      </section>
    );
  },
};

export default ProjectRepositoryHelper;
