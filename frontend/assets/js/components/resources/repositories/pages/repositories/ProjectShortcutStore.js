import ProjectsClient from '../../../../../client/ProjectsClient.js';
import HashLocation from '../../../../../utils/routing/hashLocation.js';
import ProjectErrorMessages from '../../../projects/errors/errorMessages.js';
import ProjectPaths from '../../../projects/paths.js';
import AddStateStore from './AddStateStore.js';

/**
 * The "Project" shortcut of an added repository row: opens the repository's project, creating
 * it when needed, and keeps each row's in-flight and error state (the same `{status}` shape as
 * the Add state, keyed by `githubId`).
 */
export default class ProjectShortcutStore {
  #states;

  #client;

  #location;

  /**
   * Create the store.
   *
   * @param {Function} publish - Called with a fresh `Map` copy of the row states after every
   *   change.
   * @param {typeof ProjectsClient} [client] - Projects HTTP client override, for testability.
   * @param {typeof HashLocation} [location] - Hash writer override, for testability.
   */
  constructor(publish, client = ProjectsClient, location = HashLocation) {
    this.#states = new AddStateStore(publish);
    this.#client = client;
    this.#location = location;
  }

  /**
   * Open the project of a repository: a spinner while running, then the project's page (`201`
   * and `200` alike). A taken default name opens the prefilled creation form, showing the
   * "name taken" error on Name; any other refusal shows inline under the button.
   *
   * @param {{githubId: number, fullName: string}} repository - The row's repository.
   * @returns {Promise<void>} Resolves once the request finishes.
   */
  async open(repository) {
    const { githubId } = repository;

    this.#states.pending(githubId);

    try {
      const project = await this.#client.createFromRepository({ githubId });

      this.#states.clear(githubId);

      if (project) {
        this.#location.push(ProjectPaths.show(project.id));
      }
    } catch (error) {
      this.#refused(repository, error);
    }
  }

  /**
   * Forget every row's state (unmount).
   *
   * @returns {void} Nothing.
   */
  clearAll() {
    this.#states.clearAll();
  }

  #refused({ githubId, fullName }, error) {
    if (error?.code === 'PROJECT_NAME_TAKEN') {
      this.#states.clear(githubId);
      this.#location.push(ProjectPaths.newProject({
        githubId, fullName, name: fullName, nameTaken: true,
      }));
      return;
    }

    this.#states.fail(githubId, ProjectErrorMessages.describe(error));
  }
}
