import ProjectsClient from '../../../../../client/ProjectsClient.js';
import ProjectErrorMessages from '../../errors/errorMessages.js';

/** Milliseconds after the answer at which the list is re-read once (T3). */
export const REFRESH_REREAD_MS = 10000;

/** Codes of a refusal that means the project's repository changed under the page. */
const REPOSITORY_CODES = new Set(['PROJECT_HAS_NO_REPOSITORY', 'PROJECT_REPOSITORY_UNAVAILABLE']);

/**
 * Wording of the notice after a refresh was accepted.
 *
 * @param {{enqueued: number, skippedFresh: number}} answer - The `202` body.
 * @returns {string} "Everything is up to date" when nothing was enqueued, else "Refreshing N
 *   issues (M already up to date)".
 */
function noticeOf({ enqueued, skippedFresh }) {
  if (enqueued === 0) {
    return 'Everything is up to date';
  }

  return `Refreshing ${enqueued} issues (${skippedFresh} already up to date)`;
}

/**
 * Controller of the project header's "Refresh project" action (T3).
 *
 * @description A `202` shows the notice and re-reads the list once, about 10 s later; the button
 * stays disabled until then (and while the call runs: U2). `PROJECT_HAS_NO_REPOSITORY` and
 * `PROJECT_REPOSITORY_UNAVAILABLE` show the mapped message and re-read the project. A `404`
 * re-reads the project, which then shows "Project not found". An `undefined` answer (session
 * expired) changes nothing. `dispose()` clears the timer.
 */
export default class ProjectRefreshController {
  #handlers;

  #client;

  #timers;

  #busy = false;

  #timer = null;

  /**
   * Create the controller.
   *
   * @param {{setRefreshing: Function, setNotice: Function, setError: Function,
   *   onReloadList: Function, onReloadProject: Function}} handlers - Setters of the in-flight
   *   flag, the notice text and the described error (`null` clears them), and the callbacks
   *   that re-read the list's page and the project.
   * @param {typeof ProjectsClient} [client] - Projects client override.
   * @param {{set: Function, clear: Function}} [timers] - Injected timers.
   */
  constructor(handlers, client = ProjectsClient, timers = {
    set: (callback, ms) => setTimeout(callback, ms),
    clear: (id) => clearTimeout(id),
  }) {
    this.#handlers = handlers;
    this.#client = client;
    this.#timers = timers;
  }

  /**
   * Refresh the project's issues from GitHub.
   *
   * @param {string} projectId - The project's uuid.
   * @returns {Promise<void>} Resolves once the call settled (the single re-read is scheduled).
   */
  async refresh(projectId) {
    if (this.#busy) {
      return;
    }

    this.#busy = true;
    this.#handlers.setRefreshing(true);
    this.#handlers.setNotice(null);
    this.#handlers.setError(null);

    let waiting = false;

    try {
      const answer = await this.#client.refresh(projectId);

      if (answer) {
        this.#handlers.setNotice(noticeOf(answer));
        this.#timer = this.#timers.set(() => this.#reread(), REFRESH_REREAD_MS);
        waiting = true;
      }
    } catch (error) {
      this.#fail(error);
    } finally {
      if (!waiting) {
        this.#release();
      }
    }
  }

  /**
   * Clear the pending re-read (unmount).
   *
   * @returns {void} Nothing.
   */
  dispose() {
    this.#timers.clear(this.#timer);
    this.#timer = null;
  }

  #reread() {
    this.#timer = null;
    this.#release();
    this.#handlers.onReloadList();
  }

  #release() {
    this.#busy = false;
    this.#handlers.setRefreshing(false);
  }

  #fail(error) {
    if (ProjectErrorMessages.isIssueNotFound(error)) {
      this.#handlers.onReloadProject();
      return;
    }

    if (REPOSITORY_CODES.has(error?.code)) {
      this.#handlers.onReloadProject();
    }

    this.#handlers.setError(ProjectErrorMessages.describe(error));
  }
}
