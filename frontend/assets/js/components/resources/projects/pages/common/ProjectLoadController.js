import ProjectsClient from '../../../../../client/ProjectsClient.js';

const LOAD_ERROR = 'Could not load the project.';

/** Statuses meaning the project is not there: missing, deleted, foreign, or a malformed id. */
const NOT_FOUND_STATUSES = new Set([400, 404]);

/**
 * Loads one project for its pages (the project page and project management), sorting the
 * outcome into loaded, not found (U1) and failed.
 *
 * @description A malformed id (anything but a uuid) makes the client reject as not found
 * without any request (S3). An `undefined` answer (session expired, the login modal is open)
 * leaves the state untouched.
 */
export default class ProjectLoadController {
  #setProject;

  #setLoadState;

  #client;

  #projectId = null;

  #requestId = 0;

  #disposed = false;

  /**
   * Create the controller.
   *
   * @param {{setProject: Function, setLoadState: Function}} setters - React state setters: the
   *   project, and the `{loading, error, notFound}` load state.
   * @param {typeof ProjectsClient} [client] - Projects HTTP client override, for testability.
   */
  constructor({ setProject, setLoadState }, client = ProjectsClient) {
    this.#setProject = setProject;
    this.#setLoadState = setLoadState;
    this.#client = client;
  }

  /**
   * Load a project.
   *
   * @param {string} projectId - The id taken from the hash; not trusted until the client has
   *   checked it.
   * @returns {Promise<void>} Resolves once the load finishes.
   */
  async load(projectId) {
    this.#projectId = projectId;
    this.#requestId += 1;
    const requestId = this.#requestId;

    try {
      const project = await this.#client.show(projectId);

      if (project && this.#isCurrent(requestId)) {
        this.#setProject(project);
        this.#setLoadState({ loading: false, error: null, notFound: false });
      }
    } catch (error) {
      if (this.#isCurrent(requestId)) {
        this.#setLoadState(ProjectLoadController.#failure(error));
      }
    }
  }

  /**
   * Retry a failed load, showing the loading state again meanwhile.
   *
   * @returns {Promise<void>} Resolves once the load finishes.
   */
  async retry() {
    this.#setLoadState({ loading: true, error: null, notFound: false });
    return this.load(this.#projectId);
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

  static #failure(error) {
    if (NOT_FOUND_STATUSES.has(error?.status)) {
      return { loading: false, error: null, notFound: true };
    }

    return { loading: false, error: error?.message || LOAD_ERROR, notFound: false };
  }
}
