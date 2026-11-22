import ConfirmModal from '../../../../common/confirmModal/ConfirmModal.jsx';

const WARNING = 'This permanently deletes the project, all its issues and their GitHub links. '
  + 'Changes not yet sent to GitHub are lost. This cannot be undone.';

/**
 * Render the Delete confirmation, shown only while it is open: the project's name must be
 * typed to enable it (U9).
 *
 * @param {{name: string}} project - The project.
 * @param {boolean} confirming - Whether the confirmation is open.
 * @param {{onDelete: Function, onCancel: Function}} handlers - Event handlers.
 * @returns {React.ReactElement|null} The modal, or `null` while closed.
 */
function renderConfirm(project, confirming, handlers) {
  if (!confirming) {
    return null;
  }

  return (
    <ConfirmModal
      title="Delete project"
      message={WARNING}
      confirmLabel="Delete project"
      danger
      typeToConfirm={project.name}
      onConfirm={handlers.onDelete}
      onCancel={handlers.onCancel}
    />
  );
}

/**
 * Rendering helper of the danger zone of project management.
 */
const ProjectDangerHelper = {
  /**
   * Render the danger zone: a warning and the "Delete project" button, plus its confirmation.
   * No count is shown: it is only known after the deletion.
   *
   * @param {{project: {name: string}, confirming: boolean}} state - Section state.
   * @param {{onOpen: Function, onDelete: Function, onCancel: Function}} handlers - Event
   *   handlers.
   * @returns {React.ReactElement} The section.
   */
  render(state, handlers) {
    return (
      <section className="border border-danger rounded p-3 mb-5">
        <h2 className="h4 text-danger">Danger zone</h2>
        <p>{WARNING}</p>
        <button type="button" className="btn btn-danger" onClick={handlers.onOpen}>Delete project</button>
        {renderConfirm(state.project, state.confirming, handlers)}
      </section>
    );
  },
};

export default ProjectDangerHelper;
