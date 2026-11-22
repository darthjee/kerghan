import IssuesClient from '../../../../../client/IssuesClient.js';
import { validateIssueBody, validateIssueTitle } from '../../../../../utils/validation/issueValidators.js';
import ProjectErrorMessages from '../../../projects/errors/errorMessages.js';
import FormErrors from '../../../projects/pages/common/formErrors.js';
import ProjectPaths from '../../../projects/paths.js';
import SavedIssueSignal from '../../sync/savedIssueSignal.js';

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

  #setChangedIssue;

  #onNotFound;

  #client;

  /**
   * Create the controller.
   *
   * @param {{setFieldErrors: Function, setFormError: Function, setSubmitting: Function,
   *   setChangedIssue: (Function|undefined)}} setters - React state setters: the per-field
   *   errors (`{ field: {message} }`), the form-level error, the in-flight flag and the fresher
   *   issue found by the focus re-read (U10).
   * @param {Function} onNotFound - Called when the project or issue turned out to be gone.
   * @param {typeof IssuesClient} [client] - Issues HTTP client override, for testability.
   */
  constructor({
    setFieldErrors, setFormError, setSubmitting, setChangedIssue = () => undefined,
  }, onNotFound, client = IssuesClient) {
    this.#setFieldErrors = setFieldErrors;
    this.#setFormError = setFormError;
    this.#setSubmitting = setSubmitting;
    this.#setChangedIssue = setChangedIssue;
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
   * Tell whether an `updatedAt` is later than the one the form loaded.
   *
   * @param {string} fresh - The `updatedAt` just read.
   * @param {string} loaded - The `updatedAt` the form loaded.
   * @returns {boolean} `true` when `fresh` is a later moment.
   */
  static isNewer(fresh, loaded) {
    return Date.parse(fresh) > Date.parse(loaded);
  }

  /**
   * The state of the form after "Discard my changes and reload" (U10): the fields and the
   * start values are the fresh issue's, so the form is clean and no leave prompt (U11) shows.
   *
   * @param {{title: string, body: (string|null), state: string, updatedAt: string}} fresh - The
   *   fresher issue.
   * @returns {{fields: {title: string, body: string, state: string}, updatedAt: string}} The
   *   fields to show (also the new baseline) and the `updatedAt` now loaded.
   */
  static reloaded(fresh) {
    return {
      fields: { title: fresh.title, body: fresh.body ?? '', state: fresh.state },
      updatedAt: fresh.updatedAt,
    };
  }

  /**
   * Read the issue quietly on window focus (U10), touching no field: when its `updatedAt` is
   * later than the one the form loaded, hand it on so the banner shows.
   *
   * @description A `404` means the issue is gone (U1); any other failure, and an `undefined`
   * answer, is ignored.
   * @param {string} projectId - The project's uuid.
   * @param {string} issueId - The issue's uuid.
   * @param {string} loadedUpdatedAt - The `updatedAt` the form loaded.
   * @returns {Promise<void>} Resolves once the read settled.
   */
  async checkChanged(projectId, issueId, loadedUpdatedAt) {
    try {
      const fresh = await this.#client.show(projectId, issueId);

      if (fresh && IssueFormController.isNewer(fresh.updatedAt, loadedUpdatedAt)) {
        this.#setChangedIssue(fresh);
      }
    } catch (error) {
      if (ProjectErrorMessages.isIssueNotFound(error)) {
        this.#onNotFound();
      }
    }
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
   * Validate and save the issue; a `200` records the saved-issue signal (so the issue page
   * starts the bounded re-read) and goes back to the issue page.
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
      (updated) => {
        SavedIssueSignal.record(issueId, updated);
        forceLeave(ProjectPaths.issue(projectId, issueId));
      },
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
