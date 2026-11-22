import IssuesClient from '../../../../../client/IssuesClient.js';
import HashLocation from '../../../../../utils/routing/hashLocation.js';
import ProjectErrorMessages from '../../../projects/errors/errorMessages.js';
import ProjectPaths from '../../../projects/paths.js';
import IssueNumberInput from '../issueNumberInput.js';

/**
 * Controller of the import modal: parses the typed text, imports the GitHub issue as a new
 * linked issue and goes to its page.
 *
 * @description A second submit is ignored while one is in flight (U2). An error stays inside the
 * modal, which keeps the typed value. An `undefined` answer (session expired, the login modal is
 * open) changes nothing.
 */
export default class ImportIssueController {
  #setPending;

  #setError;

  #onClose;

  #client;

  #location;

  #busy = false;

  /**
   * Create the controller.
   *
   * @param {{setPending: Function, setError: Function, onClose: Function}} handlers - The
   *   in-flight setter, the setter of the described error (`null` clears it) and the callback
   *   that closes the modal.
   * @param {typeof IssuesClient} [client] - Issues client override.
   * @param {typeof HashLocation} [location] - Hash writer override.
   */
  constructor({ setPending, setError, onClose }, client = IssuesClient, location = HashLocation) {
    this.#setPending = setPending;
    this.#setError = setError;
    this.#onClose = onClose;
    this.#client = client;
    this.#location = location;
  }

  /**
   * Import the issue the user typed.
   *
   * @param {string} projectId - The project's uuid.
   * @param {{fullName: string}} repository - The project's repository.
   * @param {string} raw - The typed text (`12`, `#12` or an issue URL).
   * @returns {Promise<void>} Resolves once the call settled.
   */
  async submit(projectId, repository, raw) {
    if (this.#busy) {
      return;
    }

    const parsed = IssueNumberInput.parse(raw, repository);

    this.#setError(parsed.error === undefined ? null : { message: parsed.error });

    if (parsed.error !== undefined) {
      return;
    }

    this.#busy = true;
    this.#setPending(true);

    try {
      await this.#import(projectId, parsed.number);
    } catch (error) {
      this.#setError(ProjectErrorMessages.describe(error));
    } finally {
      this.#busy = false;
      this.#setPending(false);
    }
  }

  async #import(projectId, number) {
    const issue = await this.#client.import(projectId, { number });

    if (issue) {
      this.#onClose();
      this.#location.push(ProjectPaths.issue(projectId, issue.id));
    }
  }
}
