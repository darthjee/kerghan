import ApiClient from './ApiClient.js';

const PROVIDER = 'github';

/**
 * Build the path of a single integration's route.
 *
 * @param {string} uuid - The integration's public UUID.
 * @param {string} [suffix] - Path suffix after the UUID (e.g. `/test`); empty for the
 *   integration itself.
 * @returns {string} The encoded `.json` route path.
 */
function integrationPath(uuid, suffix = '') {
  return `/integrations/${encodeURIComponent(uuid)}${suffix}.json`;
}

/**
 * HTTP client for the caller's GitHub integrations (`docs/agents/specs/integrations/api.md`).
 *
 * @description Every route is scoped to the logged-in user. Like the other clients, each
 * method resolves `undefined` when the session turned out to be expired (a `401` that could not
 * be recovered), and rejects with an `ApiError` on any other failure. Credentials are only ever
 * sent in a request body — never logged, persisted or put in a URL.
 */
const IntegrationsClient = {
  /**
   * List the caller's integrations, newest first.
   *
   * @returns {Promise<{integrations: Array<object>}>} The caller's integrations.
   */
  async listMine() {
    return ApiClient.postJson('/integrations/mine.json', {});
  },

  /**
   * List the integration types this server can create, in registry order.
   *
   * @returns {Promise<{types: Array<{type: string, flows: object}>}>} The enabled types and
   *   their flows.
   */
  async listTypes() {
    return ApiClient.postJson('/integrations/types.json', {});
  },

  /**
   * Create a credential-paste integration for the GitHub provider.
   *
   * @param {{label: string, type: string, credential: object}} fields - The integration's
   *   label, type and type-specific credential.
   * @returns {Promise<object>} The created integration.
   */
  async create({ label, type, credential }) {
    return ApiClient.postJson('/integrations.json', {
      label, provider: PROVIDER, type, credential,
    });
  },

  /**
   * Rename an integration.
   *
   * @param {string} uuid - The integration's public UUID.
   * @param {string} label - The new label.
   * @returns {Promise<object>} The renamed integration.
   */
  async rename(uuid, label) {
    return ApiClient.patchJson(integrationPath(uuid), { label });
  },

  /**
   * Replace an integration's credential.
   *
   * @param {string} uuid - The integration's public UUID.
   * @param {object} credential - The new type-specific credential.
   * @returns {Promise<object>} The updated integration.
   */
  async replaceCredential(uuid, credential) {
    return ApiClient.postJson(integrationPath(uuid, '/credential'), { credential });
  },

  /**
   * Test an integration's connection against GitHub.
   *
   * @param {string} uuid - The integration's public UUID.
   * @returns {Promise<object>} The integration, carrying the test outcome.
   */
  async test(uuid) {
    return ApiClient.postJson(integrationPath(uuid, '/test'), {});
  },

  /**
   * Delete an integration.
   *
   * @param {string} uuid - The integration's public UUID.
   * @returns {Promise<object>} An empty object (the route answers `204 No Content`).
   */
  async remove(uuid) {
    return ApiClient.deleteJson(integrationPath(uuid), {});
  },
};

export default IntegrationsClient;
