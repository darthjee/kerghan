import ProjectFieldsHelper from '../common/ProjectFieldsHelper.jsx';

/**
 * Rendering helper of the details section of project management.
 */
const ProjectDetailsHelper = {
  /**
   * Render the details form: Name and Description with Save and Cancel.
   *
   * @param {{name: string, description: string, fieldErrors: object, formError: (object|null),
   *   submitting: boolean}} state - Form state.
   * @param {{onNameChange: Function, onDescriptionChange: Function, onSubmit: Function,
   *   onCancel: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The section.
   */
  render(state, handlers) {
    return (
      <section className="mb-5">
        <h2 className="h4">Details</h2>
        <form onSubmit={handlers.onSubmit} noValidate>
          {ProjectFieldsHelper.renderFormError(state.formError)}
          {ProjectFieldsHelper.renderName(state, handlers)}
          {ProjectFieldsHelper.renderDescription(state, handlers)}
          <button type="submit" className="btn btn-primary me-2" disabled={state.submitting}>
            {state.submitting ? <span className="spinner-border spinner-border-sm me-1" role="status" aria-label="Saving" /> : null}
            Save
          </button>
          <button type="button" className="btn btn-outline-secondary" disabled={state.submitting} onClick={handlers.onCancel}>
            Cancel
          </button>
        </form>
      </section>
    );
  },
};

export default ProjectDetailsHelper;
