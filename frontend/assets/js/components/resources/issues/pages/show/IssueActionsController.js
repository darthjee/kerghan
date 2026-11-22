import IssuesClient from '../../../../../client/IssuesClient.js';
import HashLocation from '../../../../../utils/routing/hashLocation.js';
import ProjectErrorMessages from '../../../projects/errors/errorMessages.js';
import ProjectPaths from '../../../projects/paths.js';
import BoundedRereadController from '../../sync/BoundedRereadController.js';

/**
 * Controller of the issue page's actions: Close or Reopen, and the confirmed Delete.
 *
 * @description Close and Reopen send only `state` and show the issue the API returns. They are
 * ignored while a call is in flight (U2). On a linked, non-`gone` issue the bounded re-read then
 * runs, so Pending turns into Synced (or a failure). A `404` means the issue is gone. An `undefined` answer
 * (session expired, the login modal is open) changes nothing.
 */
export default class IssueActionsController {
  #setIssue;

  #setBusy;

  #setError;

  #onNotFound;

  #client;

  #location;

  #reread;

  #ids = null;

  #busy = false;

  /**
   * Create the controller.
   *
   * @param {{setIssue: Function, setBusy: Function, setError: Function, onNotFound: Function}}
   *   handlers - React state setters for the issue, the in-flight flag and the described
   *   action error (`null` clears it), and the callback for a vanished issue.
   * @param {typeof IssuesClient} [client] - Issues HTTP client override, for testability.
   * @param {typeof HashLocation} [location] - Hash writer override, for testability.
   * @param {Function} [rereadFactory] - Builds a `BoundedRereadController` from its options.
   */
  constructor({
    setIssue, setBusy, setError, onNotFound,
  }, client = IssuesClient, location = HashLocation, rereadFactory = (options) => new BoundedRereadController(options)) {
    this.#setIssue = setIssue;
    this.#setBusy = setBusy;
    this.#setError = setError;
    this.#onNotFound = onNotFound;
    this.#client = client;
    this.#location = location;
    this.#reread = rereadFactory({
      read: () => this.#client.show(this.#ids.projectId, this.#ids.issueId),
      onIssue: (issue) => this.#setIssue(issue),
      onNotFound: () => this.#onNotFound(),
    });
  }

  /**
   * Stop the re-read in progress (unmount).
   *
   * @returns {void} Nothing.
   */
  dispose() {
    this.#reread.dispose();
  }

  /**
   * Close an open issue, or reopen a closed one.
   *
   * @param {string} projectId - The project's uuid.
   * @param {{id: string, state: string}} issue - The issue shown.
   * @returns {Promise<void>} Resolves once the call settled.
   */
  async toggleState(projectId, issue) {
    if (this.#busy) {
      return;
    }

    this.#busy = true;
    this.#setBusy(true);
    this.#setError(null);

    try {
      const updated = await this.#client.edit(projectId, issue.id, { state: issue.state === 'open' ? 'closed' : 'open' });

      if (updated) {
        this.#setIssue(updated);
        this.#ids = { projectId, issueId: issue.id };
        this.#reread.start(updated);
      }
    } catch (error) {
      this.#fail(error);
    } finally {
      this.#busy = false;
      this.#setBusy(false);
    }
  }

  /**
   * Delete an unlinked issue and go back to the project page. A `404` counts as done.
   *
   * @param {string} projectId - The project's uuid.
   * @param {string} issueId - The issue's uuid.
   * @returns {Promise<void>} Resolves when done; rejects with an error whose message is the one
   *   to show inside the confirmation (`ISSUE_LINKED` after a race, or any other failure).
   */
  async remove(projectId, issueId) {
    try {
      if (await this.#client.delete(projectId, issueId) === undefined) {
        return;
      }
    } catch (error) {
      if (error?.status !== 404) {
        throw new Error(ProjectErrorMessages.describe(error).message);
      }
    }

    this.#location.push(ProjectPaths.show(projectId));
  }

  #fail(error) {
    if (ProjectErrorMessages.isIssueNotFound(error)) {
      this.#onNotFound();
      return;
    }

    this.#setError(ProjectErrorMessages.describe(error));
  }
}
