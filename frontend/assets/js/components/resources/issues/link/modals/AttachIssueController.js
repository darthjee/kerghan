import IssuesClient from '../../../../../client/IssuesClient.js';
import ProjectErrorMessages from '../../../projects/errors/errorMessages.js';
import IssueNumberInput from '../issueNumberInput.js';

/**
 * Controller of the attach modal: attaches an issue to a GitHub issue, with the differences
 * warning (E61).
 *
 * @description The first call is sent without `confirmUpdatedAt`. `ISSUE_ATTACH_CONFIRMATION_REQUIRED`
 * switches to the warning; confirming retries with the `updatedAt` it carried, and another such
 * `409` shows the warning again with the new differences. `ISSUE_ALREADY_LINKED` closes the modal
 * and re-reads the issue (U3). A second call is ignored while one is in flight (U2).
 */
export default class AttachIssueController {
  #handlers;

  #client;

  #busy = false;

  /**
   * Create the controller.
   *
   * @param {object} handlers - React setters and callbacks.
   * @param {Function} handlers.setPending - Setter of the in-flight flag.
   * @param {Function} handlers.setError - Setter of the described error (`null` clears it).
   * @param {Function} handlers.setWarning - Setter of the warning (`{number, differences,
   *   updatedAt}`, or `null`).
   * @param {Function} handlers.onAttached - Called with the linked issue.
   * @param {Function} handlers.onClose - Closes the modal.
   * @param {Function} handlers.onAlreadyLinked - Re-reads the issue after `ISSUE_ALREADY_LINKED`.
   * @param {Function} handlers.onNotFound - Called when the issue vanished (`404`).
   * @param {typeof IssuesClient} [client] - Issues client override.
   */
  constructor(handlers, client = IssuesClient) {
    this.#handlers = handlers;
    this.#client = client;
  }

  /**
   * Attach to the issue the user typed (the first call, with no confirmation).
   *
   * @param {string} projectId - The project's uuid.
   * @param {string} issueId - The Kerghan issue's uuid.
   * @param {{fullName: string}} repository - The project's repository.
   * @param {string} raw - The typed text (`12`, `#12` or an issue URL).
   * @returns {Promise<void>} Resolves once the call settled.
   */
  async submit(projectId, issueId, repository, raw) {
    if (this.#busy) {
      return;
    }

    const parsed = IssueNumberInput.parse(raw, repository);

    this.#handlers.setError(parsed.error === undefined ? null : { message: parsed.error });

    if (parsed.error !== undefined) {
      return;
    }

    this.#busy = true;
    this.#handlers.setPending(true);

    try {
      await this.#attach(projectId, issueId, { number: parsed.number });
    } catch (error) {
      this.#handlers.setError(ProjectErrorMessages.describe(error));
    } finally {
      this.#busy = false;
      this.#handlers.setPending(false);
    }
  }

  /**
   * Confirm the warning: attach again with the `updatedAt` it carried.
   *
   * @param {string} projectId - The project's uuid.
   * @param {string} issueId - The Kerghan issue's uuid.
   * @param {{number: number, updatedAt: string}} warning - The warning being confirmed.
   * @returns {Promise<void>} Resolves when done or when the warning was shown again; rejects
   *   with an error whose message is the one to show inside the confirmation.
   */
  async confirm(projectId, issueId, warning) {
    if (this.#busy) {
      return;
    }

    this.#busy = true;

    try {
      await this.#attach(projectId, issueId, { number: warning.number, confirmUpdatedAt: warning.updatedAt });
    } catch (error) {
      throw new Error(ProjectErrorMessages.describe(error).message);
    } finally {
      this.#busy = false;
    }
  }

  async #attach(projectId, issueId, fields) {
    try {
      const issue = await this.#client.attach(projectId, issueId, fields);

      if (issue) {
        this.#handlers.onAttached(issue);
        this.#handlers.onClose();
      }
    } catch (error) {
      this.#settle(error, fields.number);
    }
  }

  #settle(error, number) {
    if (ProjectErrorMessages.isAttachConfirmationRequired(error)) {
      this.#handlers.setError(null);
      this.#handlers.setWarning({ number, differences: error.meta?.differences, updatedAt: error.meta?.updatedAt });
    } else if (ProjectErrorMessages.isIssueAlreadyLinked(error)) {
      this.#handlers.onClose();
      this.#handlers.onAlreadyLinked();
    } else if (ProjectErrorMessages.isIssueNotFound(error)) {
      this.#handlers.onClose();
      this.#handlers.onNotFound();
    } else {
      throw error;
    }
  }
}
