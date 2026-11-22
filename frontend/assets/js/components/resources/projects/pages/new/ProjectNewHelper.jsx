import ProjectFieldsHelper from '../common/ProjectFieldsHelper.jsx';
import RepositoryPicker from '../../repositoryPicker/RepositoryPicker.jsx';

/**
 * Render the Repository field: the picker, and the repository's error.
 *
 * @param {{repository: (object|null), fieldErrors: object}} state - Form state.
 * @param {{onRepositoryChange: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The field.
 */
function renderRepository(state, handlers) {
  return (
    <div className="mb-3">
      <label className="form-label" htmlFor="project-repository">Repository</label>
      <RepositoryPicker
        selected={state.repository}
        onChange={handlers.onRepositoryChange}
        inputId="project-repository"
      />
      {ProjectFieldsHelper.renderFieldError(state.fieldErrors.repository)}
    </div>
  );
}

/**
 * Rendering helper of the explicit project creation form.
 */
const ProjectNewHelper = {
  /**
   * Render the form.
   *
   * @param {{name: string, description: string, repository: (object|null),
   *   fieldErrors: object, formError: (object|null), submitting: boolean}} state - Form
   *   state.
   * @param {{onNameChange: Function, onDescriptionChange: Function,
   *   onRepositoryChange: Function, onSubmit: Function, onCancel: Function}} handlers - Event
   *   handlers.
   * @returns {React.ReactElement} The rendered form.
   */
  render(state, handlers) {
    return (
      <div className="container mt-4">
        <h1>New project</h1>
        <form onSubmit={handlers.onSubmit} noValidate>
          {ProjectFieldsHelper.renderFormError(state.formError)}
          {ProjectFieldsHelper.renderName(state, handlers)}
          {ProjectFieldsHelper.renderDescription(state, handlers)}
          {renderRepository(state, handlers)}
          <button type="submit" className="btn btn-primary me-2" disabled={state.submitting}>
            {state.submitting ? <span className="spinner-border spinner-border-sm me-1" role="status" aria-label="Creating" /> : null}
            Create project
          </button>
          <button type="button" className="btn btn-outline-secondary" disabled={state.submitting} onClick={handlers.onCancel}>
            Cancel
          </button>
        </form>
      </div>
    );
  },
};

export default ProjectNewHelper;
