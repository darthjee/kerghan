import ProjectsClient from '../../../../../client/ProjectsClient.js';
import { validateProjectDescription, validateProjectName } from '../../../../../utils/validation/projectValidators.js';
import ProjectErrorMessages from '../../errors/errorMessages.js';
import ProjectPaths from '../../paths.js';
import FormErrors from '../common/formErrors.js';

/**
 * Controller of the details section of project management: Name and Description with Save.
 *
 * @description An unchanged Save still makes the call and simply returns. An `undefined`
 * answer (session expired, the login modal is open: U4) leaves the form mounted with its
 * values. A `404` (the project was deleted elsewhere: U1) is handed to `onNotFound`.
 */
export default class ProjectDetailsController {
  #setFieldErrors;

  #setFormError;

  #setSubmitting;

  #onNotFound;

  #client;

  /**
   * Create the controller.
   *
   * @param {{setFieldErrors: Function, setFormError: Function, setSubmitting: Function}}
   *   setters - React state setters: the per-field errors, the form-level error and the
   *   in-flight flag.
   * @param {Function} onNotFound - Called when the project turned out to be gone.
   * @param {typeof ProjectsClient} [client] - Projects HTTP client override, for testability.
   */
  constructor({ setFieldErrors, setFormError, setSubmitting }, onNotFound, client = ProjectsClient) {
    this.#setFieldErrors = setFieldErrors;
    this.#setFormError = setFormError;
    this.#setSubmitting = setSubmitting;
    this.#onNotFound = onNotFound;
    this.#client = client;
  }

  /**
   * Tell whether the details have unsaved changes.
   *
   * @param {{name: string, description: string}} fields - The current fields.
   * @param {{name: string, description: string}} initial - The values the form started with.
   * @returns {boolean} `true` when the name or description differ.
   */
  static isDirty(fields, initial) {
    return fields.name !== initial.name || fields.description !== initial.description;
  }

  /**
   * Forget the error of a field the user just edited.
   *
   * @param {string} field - `name` or `description`.
   * @returns {void} Nothing.
   */
  fieldChanged(field) {
    this.#setFieldErrors((current) => Object.fromEntries(
      Object.entries(current).filter(([key]) => key !== field),
    ));
  }

  /**
   * Validate and save the details; a `200` goes back to the project page.
   *
   * @param {string} projectId - The project's uuid.
   * @param {{name: string, description: string}} fields - The typed values.
   * @param {Function} forceLeave - Navigates to a hash without the dirty-form prompt.
   * @returns {Promise<void>} Resolves once the call settled.
   */
  async save(projectId, fields, forceLeave) {
    const errors = FormErrors.describeAll({
      ...validateProjectName(fields.name),
      ...validateProjectDescription(fields.description),
    });

    this.#setFormError(null);
    this.#setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    this.#setSubmitting(true);

    try {
      const project = await this.#client.edit(projectId, {
        name: fields.name.trim(),
        description: fields.description.trim(),
      });

      if (project) {
        forceLeave(ProjectPaths.show(projectId));
      }
    } catch (error) {
      this.#refused(error);
    } finally {
      this.#setSubmitting(false);
    }
  }

  #refused(error) {
    if (ProjectErrorMessages.isProjectNotFound(error)) {
      this.#onNotFound();
      return;
    }

    FormErrors.showRefusal(error, this.#setFieldErrors, this.#setFormError);
  }
}
