import ApiClient from './ApiClient.js';
import pathId from './pathId.js';
import pickDefined from './pickDefined.js';

/**
 * Build the path of a project-level issues route.
 *
 * @param {string} projectId - The project's uuid.
 * @param {string} action - The route's last segment (e.g. `create`).
 * @returns {string} The request path, with the id validated and encoded.
 */
function collectionPath(projectId, action) {
  return `/projects/${pathId(projectId)}/issues${action}.json`;
}

/**
 * Build the path of an issue route.
 *
 * @param {string} projectId - The project's uuid.
 * @param {string} issueId - The issue's uuid.
 * @param {string} action - The route's last segment (e.g. `show`).
 * @returns {string} The request path, with both ids validated and encoded.
 */
function issuePath(projectId, issueId, action) {
  return `/projects/${pathId(projectId)}/issues/${pathId(issueId)}/${action}.json`;
}

/**
 * HTTP client for a project's issues and their GitHub links
 * (`docs/agents/specs/issues/api/issues.md`, `api/github-link.md`).
 *
 * @description Every route is a `POST` scoped to the logged-in user. Each method resolves
 * `undefined` when the session turned out to be expired, and rejects with an `ApiError` on any
 * other failure. An id that is not a uuid rejects with a 404-shaped `ApiError` and sends no
 * request.
 */
const IssuesClient = {
  /**
   * List one page of a project's issues (bodies are never included).
   *
   * @param {string} projectId - The project's uuid.
   * @param {{state?: string, search?: string, page?: number, perPage?: number}} [options] -
   *   Filter and paging; omitted (or empty search) fields are not sent.
   * @returns {Promise<{issues: Array<object>, pagination: object}>} The page of issues.
   */
  async list(projectId, { state, search, page, perPage } = {}) {
    return ApiClient.postJson(collectionPath(projectId, ''), pickDefined({
      state, search: search === '' ? undefined : search, page, perPage,
    }));
  },

  /**
   * Create an issue (always open).
   *
   * @param {string} projectId - The project's uuid.
   * @param {{title: string, body?: (string|null)}} fields - The issue's fields.
   * @returns {Promise<object>} The new issue.
   */
  async create(projectId, { title, body }) {
    return ApiClient.postJson(collectionPath(projectId, '/create'), pickDefined({ title, body }));
  },

  /**
   * Read one issue, with its body and link.
   *
   * @param {string} projectId - The project's uuid.
   * @param {string} issueId - The issue's uuid.
   * @returns {Promise<object>} The issue.
   */
  async show(projectId, issueId) {
    return ApiClient.postJson(issuePath(projectId, issueId, 'show'), {});
  },

  /**
   * Edit an issue.
   *
   * @param {string} projectId - The project's uuid.
   * @param {string} issueId - The issue's uuid.
   * @param {{title?: string, body?: (string|null), state?: string}} fields - The fields to
   *   change; omitted fields are not sent.
   * @returns {Promise<object>} The updated issue.
   */
  async edit(projectId, issueId, { title, body, state }) {
    return ApiClient.postJson(issuePath(projectId, issueId, 'edit'), pickDefined({ title, body, state }));
  },

  /**
   * Delete an (unlinked) issue.
   *
   * @param {string} projectId - The project's uuid.
   * @param {string} issueId - The issue's uuid.
   * @returns {Promise<object>} An empty object.
   */
  async delete(projectId, issueId) {
    return ApiClient.postJson(issuePath(projectId, issueId, 'delete'), {});
  },

  /**
   * Import a GitHub issue of the project's repository as a new linked issue.
   *
   * @param {string} projectId - The project's uuid.
   * @param {{number: number}} fields - The GitHub issue number.
   * @returns {Promise<object>} The new issue.
   */
  async import(projectId, { number }) {
    return ApiClient.postJson(collectionPath(projectId, '/import'), { number });
  },

  /**
   * Attach an existing issue to a GitHub issue.
   *
   * @param {string} projectId - The project's uuid.
   * @param {string} issueId - The issue's uuid.
   * @param {{number: number, confirmUpdatedAt?: string}} fields - The GitHub issue number and,
   *   when confirming the differences warning, the `updatedAt` it carried.
   * @returns {Promise<object>} The linked issue.
   */
  async attach(projectId, issueId, { number, confirmUpdatedAt }) {
    return ApiClient.postJson(issuePath(projectId, issueId, 'attach'), pickDefined({ number, confirmUpdatedAt }));
  },

  /**
   * Unlink an issue from its GitHub issue.
   *
   * @param {string} projectId - The project's uuid.
   * @param {string} issueId - The issue's uuid.
   * @param {{discard?: boolean}} [options] - `discard: true` drops changes not yet sent to
   *   GitHub (sent as `discardUnsentChanges`).
   * @returns {Promise<{issue: object, droppedUnsentChanges: boolean}>} The unlinked issue.
   */
  async unlink(projectId, issueId, { discard } = {}) {
    return ApiClient.postJson(issuePath(projectId, issueId, 'unlink'), pickDefined({
      discardUnsentChanges: discard,
    }));
  },

  /**
   * Re-read one linked issue from GitHub (the `202` answer counts as success).
   *
   * @param {string} projectId - The project's uuid.
   * @param {string} issueId - The issue's uuid.
   * @returns {Promise<{issue: object, alreadyFresh: boolean}>} The issue and whether it was
   *   already fresh.
   */
  async refresh(projectId, issueId) {
    return ApiClient.postJson(issuePath(projectId, issueId, 'refresh'), {});
  },

  /**
   * Retry the sync of a linked issue whose sync failed.
   *
   * @param {string} projectId - The project's uuid.
   * @param {string} issueId - The issue's uuid.
   * @returns {Promise<{issue: object}>} The issue.
   */
  async retrySync(projectId, issueId) {
    return ApiClient.postJson(issuePath(projectId, issueId, 'retry-sync'), {});
  },
};

export default IssuesClient;
