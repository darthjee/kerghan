import DescribedError from '../../DescribedError.jsx';

/**
 * Rendering helper of the fields shared by the project forms (creation and management): Name
 * and Description, with their errors.
 */
const ProjectFieldsHelper = {
  /**
   * Render a field's error, shown only when it has one.
   *
   * @param {({message: string, link: (object|undefined)}|undefined)} error - The field's error.
   * @returns {React.ReactElement|null} The error, or `null` without one.
   */
  renderFieldError(error) {
    return error ? <DescribedError error={error} className="invalid-feedback d-block" /> : null;
  },

  /**
   * Render the form-level error, shown only when there is one.
   *
   * @param {({message: string}|null)} error - The form-level error.
   * @returns {React.ReactElement|null} The alert, or `null` without an error.
   */
  renderFormError(error) {
    return error ? <DescribedError error={error} className="alert alert-danger" role="alert" /> : null;
  },

  /**
   * Render the Name field.
   *
   * @param {{name: string, fieldErrors: object}} state - Form state.
   * @param {{onNameChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The field.
   */
  renderName(state, handlers) {
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
        {ProjectFieldsHelper.renderFieldError(state.fieldErrors.name)}
      </div>
    );
  },

  /**
   * Render the Description field.
   *
   * @param {{description: string, fieldErrors: object}} state - Form state.
   * @param {{onDescriptionChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The field.
   */
  renderDescription(state, handlers) {
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
        {ProjectFieldsHelper.renderFieldError(state.fieldErrors.description)}
      </div>
    );
  },
};

export default ProjectFieldsHelper;
