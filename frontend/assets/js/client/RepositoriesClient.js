import ApiClient from './ApiClient.js';
import pickDefined from './pickDefined.js';

/**
 * HTTP client for the caller's repositories (`docs/agents/specs/repos/api.md`).
 *
 * @description Every route is a `POST` scoped to the logged-in user. Like the other clients,
 * each method resolves `undefined` when the session turned out to be expired, and rejects with
 * an `ApiError` on any other failure.
 */
const RepositoriesClient = {
  /**
   * List one page of the caller's repositories.
   *
   * @param {{page?: number, perPage?: number, filter?: string, search?: string}} [options] -
   *   Paging, filter and search; omitted (or empty search) fields are not sent.
   * @returns {Promise<{repositories: Array<object>, pagination: object, sync: object}>} The
   *   page of repositories, its pagination and the sync state.
   */
  async list({ page, perPage, filter, search } = {}) {
    return ApiClient.postJson('/repositories/mine.json', pickDefined({
      page, perPage, filter, search: search === '' ? undefined : search,
    }));
  },

  /**
   * Read the sync state (never starts a sync).
   *
   * @returns {Promise<object>} The sync-state object.
   */
  async syncState() {
    return ApiClient.postJson('/repositories/sync/state.json', {});
  },

  /**
   * Force a sync of every source (the `202` answer counts as success).
   *
   * @returns {Promise<object>} The sync-state object.
   */
  async refresh() {
    return ApiClient.postJson('/repositories/sync.json', {});
  },

  /**
   * Mark a repository of the caller's listing as added.
   *
   * @param {number} githubId - The repository's GitHub id.
   * @returns {Promise<object>} The updated repository row.
   */
  async add(githubId) {
    return ApiClient.postJson('/repositories/add.json', { githubId });
  },
};

export default RepositoriesClient;
