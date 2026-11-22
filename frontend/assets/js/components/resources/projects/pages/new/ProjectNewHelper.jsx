import DescribedError from '../../DescribedError.jsx';
import RepositoryPicker from '../../repositoryPicker/RepositoryPicker.jsx';

/**
 * Render a field's error, shown only when it has one.
 *
 * @param {({message: string, link: (object|undefined)}|undefined)} error - The field's error.
 * @returns {React.ReactElement|null} The error, or `null` without one.
 */
function renderFieldError(error) {
  return error ? <DescribedError error={error} className="invalid-feedback d-block" /> : null;
}

/**
 * Render the Name field.
 *
 * @param {{name: string, fieldErrors: object}} state - Form state.
 * @param {{onNameChange: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The field.
 */
function renderName(state, handlers) {
  return (
    <div className="mb-3">
      <label className="form-label" htmlFor="project-name">Name</label>
      <input
        id="project-name"
        type="text"
        className={`form-control${state.fieldErrors.name ? ' is-invalid' : ''}`}
        value={state.name}
        onChange={handlers.onNameChange}
      />
      {renderFieldError(state.fieldErrors.name)}
    </div>
  );
}

/**
 * Render the Description field.
 *
 * @param {{description: string, fieldErrors: object}} state - Form state.
 * @param {{onDescriptionChange: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The field.
 */
function renderDescription(state, handlers) {
  return (
    <div className="mb-3">
      <label className="form-label" htmlFor="project-description">Description</label>
      <textarea
        id="project-description"
        rows={3}
        className={`form-control${state.fieldErrors.description ? ' is-invalid' : ''}`}
        value={state.description}
        onChange={handlers.onDescriptionChange}
      />
      {renderFieldError(state.fieldErrors.description)}
    </div>
  );
}

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
      {renderFieldError(state.fieldErrors.repository)}
    </div>
  );
}

/**
 * Render the form-level error, shown only when there is one.
 *
 * @param {({message: string}|null)} error - The form-level error.
 * @returns {React.ReactElement|null} The alert, or `null` without an error.
 */
function renderFormError(error) {
  return error ? <DescribedError error={error} className="alert alert-danger" role="alert" /> : null;
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
          {renderFormError(state.formError)}
          {renderName(state, handlers)}
          {renderDescription(state, handlers)}
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
