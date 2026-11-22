import IssuesClient from '../../../../../client/IssuesClient.js';
import { validateIssueBody, validateIssueTitle } from '../../../../../utils/validation/issueValidators.js';
import ProjectErrorMessages from '../../../projects/errors/errorMessages.js';
import FormErrors from '../../../projects/pages/common/formErrors.js';
import ProjectPaths from '../../../projects/paths.js';

/**
 * Controller of the issue create and edit forms: validation, the create or save call and the
 * mapping of refusals to the form.
 *
 * @description Every refusal is form-level (`ISSUES_LIMIT_REACHED`, `ISSUE_EDIT_RATE_LIMITED`
 * with its countdown, `VALIDATION_FAILED` with its details) and keeps the typed values. A `404`
 * is handed to `onNotFound`. An `undefined` answer (session expired, the login modal is open:
 * U4) leaves the form untouched and mounted with its values. The title is trimmed before it is
 * sent; the body is sent as typed.
 */
export default class IssueFormController {
  #setFieldErrors;

  #setFormError;

  #setSubmitting;

  #onNotFound;

  #client;

  /**
   * Create the controller.
   *
   * @param {{setFieldErrors: Function, setFormError: Function, setSubmitting: Function}}
   *   setters - React state setters: the per-field errors (`{ field: {message} }`), the
   *   form-level error and the in-flight flag.
   * @param {Function} onNotFound - Called when the project or issue turned out to be gone.
   * @param {typeof IssuesClient} [client] - Issues HTTP client override, for testability.
   */
  constructor({ setFieldErrors, setFormError, setSubmitting }, onNotFound, client = IssuesClient) {
    this.#setFieldErrors = setFieldErrors;
    this.#setFormError = setFormError;
    this.#setSubmitting = setSubmitting;
    this.#onNotFound = onNotFound;
    this.#client = client;
  }

  /**
   * Tell whether the form has unsaved changes.
   *
   * @param {{title: string, body: string, state: string}} fields - The current fields.
   * @param {{title: string, body: string, state: string}} initial - The values the form
   *   started with.
   * @returns {boolean} `true` when the title, body or state differ.
   */
  static isDirty(fields, initial) {
    return fields.title !== initial.title || fields.body !== initial.body || fields.state !== initial.state;
  }

  /**
   * Forget the error of a field the user just edited.
   *
   * @param {string} field - `title`, `body` or `state`.
   * @returns {void} Nothing.
   */
  fieldChanged(field) {
    this.#setFieldErrors((current) => Object.fromEntries(
      Object.entries(current).filter(([key]) => key !== field),
    ));
  }

  /**
   * Validate and create the issue; a `201` goes to the new issue's page.
   *
   * @param {string} projectId - The project's uuid.
   * @param {{title: string, body: string}} fields - The typed values.
   * @param {Function} forceLeave - Navigates to a hash without the dirty-form prompt.
   * @returns {Promise<void>} Resolves once the call settled.
   */
  async create(projectId, fields, forceLeave) {
    return this.#run(
      fields,
      () => this.#client.create(projectId, { title: fields.title.trim(), body: fields.body }),
      (created) => forceLeave(ProjectPaths.issue(projectId, created.id)),
    );
  }

  /**
   * Validate and save the issue; a `200` goes back to the issue page.
   *
   * @param {string} projectId - The project's uuid.
   * @param {string} issueId - The issue's uuid.
   * @param {{title: string, body: string, state: string}} fields - The typed values.
   * @param {Function} forceLeave - Navigates to a hash without the dirty-form prompt.
   * @returns {Promise<void>} Resolves once the call settled.
   */
  async save(projectId, issueId, fields, forceLeave) {
    return this.#run(
      fields,
      () => this.#client.edit(projectId, issueId, { title: fields.title.trim(), body: fields.body, state: fields.state }),
      () => forceLeave(ProjectPaths.issue(projectId, issueId)),
    );
  }

  async #run(fields, request, onDone) {
    const errors = FormErrors.describeAll({
      ...validateIssueTitle(fields.title),
      ...validateIssueBody(fields.body),
    });

    this.#setFormError(null);
    this.#setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    this.#setSubmitting(true);

    try {
      const result = await request();

      if (result) {
        onDone(result);
      }
    } catch (error) {
      this.#refused(error);
    } finally {
      this.#setSubmitting(false);
    }
  }

  #refused(error) {
    if (ProjectErrorMessages.isIssueNotFound(error)) {
      this.#onNotFound();
      return;
    }

    this.#setFormError(ProjectErrorMessages.describe(error));
  }
}
