import ProjectsClient from '../../../../../client/ProjectsClient.js';
import ProjectErrorMessages from '../../errors/errorMessages.js';

/**
 * Controller of the repository section of project management: connecting, changing and
 * detaching the repository. Every action runs immediately, separately from the details Save.
 *
 * @description A refusal (`PROJECT_HAS_LINKS` with its `meta.linkCount`,
 * `PROJECT_REPOSITORY_TAKEN`, `PROJECT_REPOSITORY_NOT_ADDED`, the repository `404`,
 * `PROJECT_REPOSITORY_CHANGED`) shows in the section. The buttons are never pre-disabled: the
 * refusal is the only signal. An `undefined` answer (session expired, the login modal is open)
 * leaves the section untouched. A project `404` (U1) is handed to `onNotFound`.
 */
export default class ProjectRepositoryController {
  #setters;

  #onProjectChange;

  #onNotFound;

  #client;

  /**
   * Create the controller.
   *
   * @param {{setPicking: Function, setConfirmingDetach: Function, setPending: Function,
   *   setError: Function}} setters - React state setters: whether the picker is open, whether
   *   the Detach confirmation is open, the in-flight flag and the section's error.
   * @param {{onProjectChange: Function, onNotFound: Function}} callbacks - Called with the
   *   updated project, and when the project turned out to be gone.
   * @param {typeof ProjectsClient} [client] - Projects HTTP client override, for testability.
   */
  constructor(setters, { onProjectChange, onNotFound }, client = ProjectsClient) {
    this.#setters = setters;
    this.#onProjectChange = onProjectChange;
    this.#onNotFound = onNotFound;
    this.#client = client;
  }

  /**
   * Open the picker ("Change" or "Connect a repository"), forgetting the last error.
   *
   * @returns {void} Nothing.
   */
  openPicker() {
    this.#setters.setError(null);
    this.#setters.setPicking(true);
  }

  /**
   * Close the picker without a change.
   *
   * @returns {void} Nothing.
   */
  closePicker() {
    this.#setters.setPicking(false);
  }

  /**
   * Open or close the Detach confirmation, forgetting the last error when opening.
   *
   * @param {boolean} open - Whether the confirmation is open.
   * @returns {void} Nothing.
   */
  confirmDetach(open) {
    if (open) {
      this.#setters.setError(null);
    }

    this.#setters.setConfirmingDetach(open);
  }

  /**
   * Connect or change the repository to the picked one.
   *
   * @param {string} projectId - The project's uuid.
   * @param {{githubId: number}|null} repository - The picked repository (`null` is ignored).
   * @returns {Promise<void>} Resolves once the call settled.
   */
  async pick(projectId, repository) {
    if (repository === null) {
      return;
    }

    await this.#change(projectId, { githubId: repository.githubId });
  }

  /**
   * Detach the repository (after the confirmation); the confirmation closes either way, and a
   * refusal shows in the section.
   *
   * @param {string} projectId - The project's uuid.
   * @returns {Promise<void>} Resolves once the call settled.
   */
  async detach(projectId) {
    await this.#change(projectId, null);
    this.#setters.setConfirmingDetach(false);
  }

  async #change(projectId, repository) {
    this.#setters.setPending(true);
    this.#setters.setError(null);

    try {
      const project = await this.#client.setRepository(projectId, repository);

      if (project) {
        this.#setters.setPicking(false);
        this.#onProjectChange(project);
      }
    } catch (error) {
      this.#refused(error);
    } finally {
      this.#setters.setPending(false);
    }
  }

  #refused(error) {
    if (ProjectErrorMessages.isProjectNotFound(error)) {
      this.#onNotFound();
      return;
    }

    this.#setters.setError(ProjectErrorMessages.describe(error));
  }
}
