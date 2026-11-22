import IssuesClient from '../../../../../client/IssuesClient.js';
import ProjectsClient from '../../../../../client/ProjectsClient.js';

const LOAD_ERROR = 'Could not load the issue.';

/** Statuses meaning the thing is not there: missing, deleted, foreign, or a malformed id. */
const NOT_FOUND_STATUSES = new Set([400, 404]);

/**
 * Loads a project and one of its issues for the issue pages (the issue page and the edit form),
 * sorting the outcome into loaded, project not found, issue not found (U1) and failed.
 *
 * @description The project loads first. A malformed id (anything but a uuid) makes the clients
 * reject as not found without any request (S3). An `undefined` answer (session expired, the
 * login modal is open) leaves the state untouched.
 */
export default class IssueLoadController {
  #setProject;

  #setIssue;

  #setLoadState;

  #projectsClient;

  #issuesClient;

  #ids = null;

  #requestId = 0;

  #disposed = false;

  /**
   * Create the controller.
   *
   * @param {{setProject: Function, setIssue: Function, setLoadState: Function}} setters -
   *   React state setters: the project, the issue, and the `{loading, error, notFound}` load
   *   state (`notFound` is `null`, `'project'` or `'issue'`).
   * @param {typeof ProjectsClient} [projectsClient] - Projects client override.
   * @param {typeof IssuesClient} [issuesClient] - Issues client override.
   */
  constructor({ setProject, setIssue, setLoadState }, projectsClient = ProjectsClient, issuesClient = IssuesClient) {
    this.#setProject = setProject;
    this.#setIssue = setIssue;
    this.#setLoadState = setLoadState;
    this.#projectsClient = projectsClient;
    this.#issuesClient = issuesClient;
  }

  /**
   * Load the project, then the issue.
   *
   * @param {string} projectId - The project id taken from the hash; not trusted until the
   *   client has checked it.
   * @param {string} issueId - The issue id taken from the hash; same.
   * @returns {Promise<void>} Resolves once the load finishes.
   */
  async load(projectId, issueId) {
    this.#ids = { projectId, issueId };
    this.#requestId += 1;
    const requestId = this.#requestId;
    let stage = 'project';

    try {
      const project = await this.#projectsClient.show(projectId);

      if (!project || !this.#isCurrent(requestId)) {
        return;
      }

      stage = 'issue';
      const issue = await this.#issuesClient.show(projectId, issueId);

      if (issue && this.#isCurrent(requestId)) {
        this.#setProject(project);
        this.#setIssue(issue);
        this.#setLoadState({ loading: false, error: null, notFound: null });
      }
    } catch (error) {
      if (this.#isCurrent(requestId)) {
        this.#setLoadState(IssueLoadController.#failure(error, stage));
      }
    }
  }

  /**
   * Retry a failed load, showing the loading state again meanwhile.
   *
   * @returns {Promise<void>} Resolves once the load finishes.
   */
  async retry() {
    this.#setLoadState({ loading: true, error: null, notFound: null });
    return this.load(this.#ids.projectId, this.#ids.issueId);
  }

  /**
   * Ignore any answer still in flight (unmount).
   *
   * @returns {void} Nothing.
   */
  dispose() {
    this.#disposed = true;
  }

  #isCurrent(requestId) {
    return !this.#disposed && requestId === this.#requestId;
  }

  static #failure(error, stage) {
    if (NOT_FOUND_STATUSES.has(error?.status)) {
      return { loading: false, error: null, notFound: stage };
    }

    return { loading: false, error: error?.message || LOAD_ERROR, notFound: null };
  }
}
