import IssuesClient from '../../../../client/IssuesClient.js';
import ProjectErrorMessages from '../../projects/errors/errorMessages.js';
import BoundedRereadController from '../sync/BoundedRereadController.js';

/** Codes of a refused action that mean the issue changed under the panel: re-read it once. */
const REREAD_CODES = new Set(['ISSUE_LINK_GONE', 'ISSUE_NOT_LINKED', 'PROJECT_REPOSITORY_UNAVAILABLE']);

/** The text of the notice after a refresh that found the issue fresh. */
export const ALREADY_FRESH_NOTICE = 'Already up to date';

/**
 * Controller of the link panel's actions: Refresh (T2), Retry sync (T4) and Unlink.
 *
 * @description Every action ignores a second call while one is in flight (U2). A `202` starts
 * the bounded re-read, and the action stays "active" (so its button reads "Refreshing…" or
 * "Retrying…") until it stops. A refusal that means the issue changed (E64, U3) re-reads it once
 * and shows the mapped message; a `404` means the issue is gone (U1). An `undefined` answer
 * (session expired, the login modal is open) changes nothing.
 */
export default class LinkPanelController {
  #setIssue;

  #setActivity;

  #setNotice;

  #setError;

  #setConfirming;

  #onNotFound;

  #client;

  #reread;

  #busy = false;

  #ids = null;

  /**
   * Create the controller.
   *
   * @param {object} handlers - React state setters and callbacks.
   * @param {Function} handlers.setIssue - Shows an issue.
   * @param {Function} handlers.setActivity - Sets the active action (`'refresh'`, `'retrySync'`,
   *   `'unlink'`) or `null`.
   * @param {Function} handlers.setNotice - Sets the notice text (`null` clears it).
   * @param {Function} handlers.setError - Sets the described error (`null` clears it).
   * @param {Function} handlers.setConfirming - Opens or closes the discard confirmation.
   * @param {Function} handlers.onNotFound - Called when the issue vanished (`404`).
   * @param {typeof IssuesClient} [client] - Issues client override.
   * @param {Function} [rereadFactory] - Builds a `BoundedRereadController` from its options.
   */
  constructor({
    setIssue, setActivity, setNotice, setError, setConfirming, onNotFound,
  }, client = IssuesClient, rereadFactory = (options) => new BoundedRereadController(options)) {
    this.#setIssue = setIssue;
    this.#setActivity = setActivity;
    this.#setNotice = setNotice;
    this.#setError = setError;
    this.#setConfirming = setConfirming;
    this.#onNotFound = onNotFound;
    this.#client = client;
    this.#reread = rereadFactory({
      read: () => this.#read(),
      onIssue: (issue) => this.#setIssue(issue),
      onDone: () => this.#finish(),
      onNotFound: () => this.#onNotFound(),
    });
  }

  /**
   * Refresh a linked issue from GitHub (T2).
   *
   * @param {string} projectId - The project's uuid.
   * @param {string} issueId - The issue's uuid.
   * @returns {Promise<void>} Resolves once the call settled (the re-read keeps running).
   */
  async refresh(projectId, issueId) {
    await this.#trigger('refresh', projectId, issueId, async () => {
      const answer = await this.#client.refresh(projectId, issueId);

      if (answer?.alreadyFresh) {
        this.#setNotice(ALREADY_FRESH_NOTICE);
      }

      return answer && { issue: answer.issue, reread: !answer.alreadyFresh };
    });
  }

  /**
   * Retry the sync of a failed link (T4).
   *
   * @description The `200` no-op answers like the `202`, with a body of just the issue; it is
   * told by the link still being `sync_failed` (a `202` resets it at once), and then not
   * re-read.
   * @param {string} projectId - The project's uuid.
   * @param {string} issueId - The issue's uuid.
   * @returns {Promise<void>} Resolves once the call settled (the re-read keeps running).
   */
  async retrySync(projectId, issueId) {
    await this.#trigger('retrySync', projectId, issueId, async () => {
      const answer = await this.#client.retrySync(projectId, issueId);

      return answer && { issue: answer.issue, reread: !answer.issue?.link?.states?.includes('sync_failed') };
    });
  }

  /**
   * Unlink an issue, without confirmation (the first call).
   *
   * @description `ISSUE_UNLINK_HAS_UNSENT_CHANGES` opens the discard confirmation (E63).
   * @param {string} projectId - The project's uuid.
   * @param {object} issue - The issue shown.
   * @returns {Promise<void>} Resolves once the call settled.
   */
  async unlink(projectId, issue) {
    if (this.#busy) {
      return;
    }

    this.#start('unlink');

    try {
      await this.#unlinkCall(projectId, issue, {});
    } catch (error) {
      await this.#failUnlink(projectId, issue, error);
    } finally {
      this.#finish();
    }
  }

  /**
   * Unlink an issue, discarding the changes not yet sent to GitHub (the confirmed call, E63).
   *
   * @param {string} projectId - The project's uuid.
   * @param {object} issue - The issue shown.
   * @returns {Promise<void>} Resolves when done; rejects with an error whose message is the one
   *   to show inside the confirmation.
   */
  async confirmDiscard(projectId, issue) {
    if (this.#busy) {
      return;
    }

    this.#start('unlink');

    try {
      await this.#unlinkCall(projectId, issue, { discard: true });
      this.#setConfirming(false);
    } catch (error) {
      await this.#failDiscard(projectId, issue, error);
    } finally {
      this.#finish();
    }
  }

  /**
   * Close the discard confirmation.
   *
   * @returns {void} Nothing.
   */
  cancelDiscard() {
    this.#setConfirming(false);
  }

  /**
   * Stop the re-read in progress.
   *
   * @returns {void} Nothing.
   */
  dispose() {
    this.#reread.dispose();
  }

  async #trigger(action, projectId, issueId, call) {
    if (this.#busy) {
      return;
    }

    this.#start(action);
    this.#ids = { projectId, issueId };
    let rereading = false;

    try {
      const answer = await call();

      if (answer) {
        this.#setIssue(answer.issue);
        rereading = answer.reread && this.#reread.start(answer.issue);
      }
    } catch (error) {
      await this.#fail(projectId, issueId, error);
    } finally {
      if (!rereading) {
        this.#finish();
      }
    }
  }

  #start(action) {
    this.#busy = true;
    this.#setActivity(action);
    this.#setNotice(null);
    this.#setError(null);
  }

  #finish() {
    this.#busy = false;
    this.#setActivity(null);
  }

  async #read() {
    return this.#client.show(this.#ids.projectId, this.#ids.issueId);
  }

  async #unlinkCall(projectId, issue, options) {
    const answer = await this.#client.unlink(projectId, issue.id, options);

    if (answer) {
      this.#setIssue(answer.issue);
    }
  }

  async #fail(projectId, issueId, error) {
    if (ProjectErrorMessages.isIssueNotFound(error)) {
      this.#onNotFound();
      return;
    }

    if (REREAD_CODES.has(error?.code)) {
      await this.#readOnce(projectId, issueId);
    }

    this.#setError(ProjectErrorMessages.describe(error));
  }

  async #failUnlink(projectId, issue, error) {
    if (ProjectErrorMessages.isUnlinkHasUnsentChanges(error)) {
      this.#setConfirming(true);
      return;
    }

    if (ProjectErrorMessages.isIssueNotLinked(error)) {
      await this.#showUnlinked(projectId, issue);
      return;
    }

    await this.#fail(projectId, issue.id, error);
  }

  async #failDiscard(projectId, issue, error) {
    if (ProjectErrorMessages.isIssueNotLinked(error)) {
      await this.#showUnlinked(projectId, issue);
      this.#setConfirming(false);
      return;
    }

    if (ProjectErrorMessages.isIssueNotFound(error)) {
      this.#setConfirming(false);
      this.#onNotFound();
      return;
    }

    throw new Error(ProjectErrorMessages.describe(error).message);
  }

  async #showUnlinked(projectId, issue) {
    const reread = await this.#readOnce(projectId, issue.id);

    if (!reread) {
      this.#setIssue({ ...issue, link: null });
    }
  }

  async #readOnce(projectId, issueId) {
    try {
      const issue = await this.#client.show(projectId, issueId);

      if (issue) {
        this.#setIssue(issue);
      }

      return Boolean(issue);
    } catch (error) {
      if (ProjectErrorMessages.isIssueNotFound(error)) {
        this.#onNotFound();
      }

      return false;
    }
  }
}
