import ProjectsClient from '../../../../../client/ProjectsClient.js';
import {
  validateProjectDescription, validateProjectName,
  MAX_PROJECT_NAME_LENGTH,
} from '../../../../../utils/validation/projectValidators.js';
import FormErrors from '../common/formErrors.js';
import ProjectPaths from '../../paths.js';

/**
 * Controller of the explicit project creation form: validation, the create call and the
 * mapping of refusals to the Name field, the Repository field or the form.
 *
 * @description An `undefined` answer (session expired, the login modal is open: U4) leaves the
 * form untouched and mounted with its values.
 */
export default class ProjectNewController {
  #setFieldErrors;

  #setFormError;

  #setSubmitting;

  #client;

  /**
   * Create the controller.
   *
   * @param {{setFieldErrors: Function, setFormError: Function, setSubmitting: Function}}
   *   setters - React state setters: the per-field errors (`{ field: {message, link?} }`), the
   *   form-level error and the in-flight flag.
   * @param {typeof ProjectsClient} [client] - Projects HTTP client override, for testability.
   */
  constructor({ setFieldErrors, setFormError, setSubmitting }, client = ProjectsClient) {
    this.#setFieldErrors = setFieldErrors;
    this.#setFormError = setFormError;
    this.#setSubmitting = setSubmitting;
    this.#client = client;
  }

  /**
   * Read the form's start values from the hash query
   * (`?repository=<githubId>&repositoryName=<owner/name>&name=<name>&error=name_taken`).
   *
   * @description `repository` must be a positive integer (else it is ignored); `repositoryName`
   * is for display only and falls back to the id. Nothing from the query is ever used as
   * markup or in a request path.
   * @param {string} hash - The location hash.
   * @returns {{fields: {name: string, description: string, repository: (object|null)},
   *   nameTaken: boolean}} The start fields, and whether to show the "name taken" error.
   */
  static parsePrefill(hash) {
    const params = new URLSearchParams(String(hash).split('?').slice(1).join('?'));
    const githubId = params.get('repository') ?? '';
    const hasRepository = /^[1-9]\d{0,15}$/.test(githubId);
    const repositoryName = params.get('repositoryName') || `Repository #${githubId}`;

    return {
      fields: {
        name: Array.from(params.get('name') ?? '').slice(0, MAX_PROJECT_NAME_LENGTH).join(''),
        description: '',
        repository: hasRepository ? { githubId: Number(githubId), fullName: repositoryName } : null,
      },
      nameTaken: hasRepository && params.get('error') === 'name_taken',
    };
  }

  /**
   * Tell whether the form has unsaved changes compared to its start values.
   *
   * @param {object} fields - The current fields.
   * @param {object} initial - The start fields.
   * @returns {boolean} `true` when the name, description or repository differ.
   */
  static isDirty(fields, initial) {
    return fields.name !== initial.name
      || fields.description !== initial.description
      || fields.repository?.githubId !== initial.repository?.githubId;
  }

  /**
   * Forget the error of a field the user just edited.
   *
   * @param {string} field - `name`, `description` or `repository`.
   * @returns {void} Nothing.
   */
  fieldChanged(field) {
    this.#setFieldErrors((current) => Object.fromEntries(
      Object.entries(current).filter(([key]) => key !== field),
    ));
  }

  /**
   * Validate and submit the form; a `201` goes to the new project's page.
   *
   * @param {{name: string, description: string, repository: (object|null)}} fields - The
   *   typed values.
   * @param {Function} forceLeave - Navigates to a hash without the dirty-form prompt.
   * @returns {Promise<void>} Resolves once the call settled.
   */
  async submit(fields, forceLeave) {
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
      const project = await this.#client.create({
        name: fields.name.trim(),
        description: fields.description.trim(),
        repository: fields.repository ? { githubId: fields.repository.githubId } : null,
      });

      if (project) {
        forceLeave(ProjectPaths.show(project.id));
      }
    } catch (error) {
      FormErrors.showRefusal(error, this.#setFieldErrors, this.#setFormError);
    } finally {
      this.#setSubmitting(false);
    }
  }
}
