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

  #loaded = false;

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
    return this.#run(false);
  }

  /**
   * Re-read the project quietly: the view stays mounted, with no loading state.
   *
   * @description Used on window focus and after a refusal that means the project changed. A
   * not-found answer shows "Project not found" (U1); any other failure is ignored. Does nothing
   * until a load succeeded.
   * @returns {Promise<void>} Resolves once the read finishes.
   */
  async reread() {
    if (this.#loaded) {
      await this.#run(true);
    }
  }

  async #run(quiet) {
    this.#requestId += 1;
    const requestId = this.#requestId;

    try {
      const project = await this.#client.show(this.#projectId);

      if (project && this.#isCurrent(requestId)) {
        this.#setProject(project);
        this.#loaded = true;
        this.#succeed(quiet);
      }
    } catch (error) {
      this.#fail(requestId, error, quiet);
    }
  }

  #succeed(quiet) {
    if (!quiet) {
      this.#setLoadState({ loading: false, error: null, notFound: false });
    }
  }

  #fail(requestId, error, quiet) {
    const ignored = quiet && !NOT_FOUND_STATUSES.has(error?.status);

    if (this.#isCurrent(requestId) && !ignored) {
      this.#setLoadState(ProjectLoadController.#failure(error));
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
