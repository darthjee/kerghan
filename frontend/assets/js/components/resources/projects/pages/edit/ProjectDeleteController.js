import ProjectsClient from '../../../../../client/ProjectsClient.js';
import ProjectNoticeStore from '../../ProjectNoticeStore.js';
import ProjectPaths from '../../paths.js';

/**
 * Controller of the danger zone of project management: the confirmed deletion.
 *
 * @description A `200` records the one-time notice (with `unsentIssueCount` when above 0) and
 * goes to the project list. A `404` (already deleted elsewhere) counts as done. Any other
 * failure rejects, so the confirmation modal shows it inside. An `undefined` answer (session
 * expired, the login modal is open) leaves the modal open.
 */
export default class ProjectDeleteController {
  #client;

  /**
   * Create the controller.
   *
   * @param {typeof ProjectsClient} [client] - Projects HTTP client override, for testability.
   */
  constructor(client = ProjectsClient) {
    this.#client = client;
  }

  /**
   * Delete the project.
   *
   * @param {string} projectId - The project's uuid.
   * @param {Function} forceLeave - Navigates to a hash without the dirty-form prompt.
   * @returns {Promise<void>} Resolves when done; rejects with the error to show in the modal.
   */
  async remove(projectId, forceLeave) {
    try {
      const result = await this.#client.delete(projectId);

      if (result === undefined) {
        return;
      }

      ProjectNoticeStore.setDeleted(result.unsentIssueCount);
    } catch (error) {
      if (error?.status !== 404) {
        throw error;
      }

      ProjectNoticeStore.setDeleted(0);
    }

    forceLeave(ProjectPaths.list);
  }
}
