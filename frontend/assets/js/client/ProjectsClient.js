import ApiClient from './ApiClient.js';
import pathId from './pathId.js';
import pickDefined from './pickDefined.js';

/**
 * Build the path of a project route.
 *
 * @param {string} projectId - The project's uuid.
 * @param {string} action - The route's last segment (e.g. `show`).
 * @returns {string} The request path, with the id validated and encoded.
 */
function projectPath(projectId, action) {
  return `/projects/${pathId(projectId)}/${action}.json`;
}

/**
 * HTTP client for the caller's projects (`docs/agents/backend/routes/issues/projects.md`).
 *
 * @description Every route is a `POST` scoped to the logged-in user. Each method resolves
 * `undefined` when the session turned out to be expired, and rejects with an `ApiError` on any
 * other failure. A project id that is not a uuid rejects with a 404-shaped `ApiError` and sends
 * no request.
 */
const ProjectsClient = {
  /**
   * List one page of the caller's projects.
   *
   * @param {{page?: number, perPage?: number, search?: string}} [options] - Paging and name
   *   search; omitted (or empty search) fields are not sent.
   * @returns {Promise<{projects: Array<object>, pagination: object}>} The page of projects.
   */
  async list({ page, perPage, search } = {}) {
    return ApiClient.postJson('/projects/mine.json', pickDefined({
      page, perPage, search: search === '' ? undefined : search,
    }));
  },

  /**
   * Create a project.
   *
   * @param {{name: string, description?: (string|null), repository?: ({githubId: number}|null)}}
   *   fields - The project's fields; `repository` is a ref or `null` (no repository).
   * @returns {Promise<object>} The new project.
   */
  async create({ name, description, repository }) {
    return ApiClient.postJson('/projects/create.json', pickDefined({ name, description, repository }));
  },

  /**
   * Create (or fetch) the project of an added repository.
   *
   * @param {{githubId: number, name?: string}} fields - The repository's GitHub id and an
   *   optional name (the default is `owner/name`).
   * @returns {Promise<object>} The project (`201` new, `200` existing).
   */
  async createFromRepository({ githubId, name }) {
    return ApiClient.postJson('/projects/from-repository.json', pickDefined({
      repository: { githubId }, name,
    }));
  },

  /**
   * Read one project.
   *
   * @param {string} projectId - The project's uuid.
   * @returns {Promise<object>} The project.
   */
  async show(projectId) {
    return ApiClient.postJson(projectPath(projectId, 'show'), {});
  },

  /**
   * Edit a project's name and description.
   *
   * @param {string} projectId - The project's uuid.
   * @param {{name?: string, description?: (string|null)}} fields - The fields to change.
   * @returns {Promise<object>} The updated project.
   */
  async edit(projectId, { name, description }) {
    return ApiClient.postJson(projectPath(projectId, 'edit'), pickDefined({ name, description }));
  },

  /**
   * Connect, change or detach a project's repository.
   *
   * @param {string} projectId - The project's uuid.
   * @param {{githubId: number}|null} repository - The repository ref, or `null` to detach.
   * @returns {Promise<object>} The updated project.
   */
  async setRepository(projectId, repository) {
    return ApiClient.postJson(projectPath(projectId, 'repository'), { repository });
  },

  /**
   * Delete a project, with its issues and links.
   *
   * @param {string} projectId - The project's uuid.
   * @returns {Promise<{unsentIssueCount: number}>} How many issues had unsent changes.
   */
  async delete(projectId) {
    return ApiClient.postJson(projectPath(projectId, 'delete'), {});
  },

  /**
   * Re-read every linked issue of a project (the `202` answer counts as success).
   *
   * @param {string} projectId - The project's uuid.
   * @returns {Promise<{enqueued: number, skippedFresh: number}>} The refresh summary.
   */
  async refresh(projectId) {
    return ApiClient.postJson(projectPath(projectId, 'refresh'), {});
  },
};

export default ProjectsClient;
