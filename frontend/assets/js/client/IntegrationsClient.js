import ApiClient from './ApiClient.js';
import pickDefined from './pickDefined.js';

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

  /**
   * Start the OAuth App redirect flow, either creating a new integration or reconnecting
   * (replacing the credential of) an existing `oauth_app` one.
   *
   * @param {{label: string}|{integrationId: string}} body - `{ label }` to create, or
   *   `{ integrationId }` to reconnect an existing integration.
   * @returns {Promise<{authorizeUrl: string}>} The GitHub authorize URL to navigate to.
   */
  async startOauthApp(body) {
    return ApiClient.postJson('/integrations/oauth_app/start.json', body);
  },

  /**
   * Complete the OAuth App redirect flow with the values GitHub sent back to the landing page.
   *
   * @param {{code: string, state: string}} values - The `code` and `state` from GitHub's
   *   redirect; sent only in the request body.
   * @returns {Promise<object>} The created or reconnected integration.
   */
  async completeOauthApp({ code, state }) {
    return ApiClient.postJson('/integrations/oauth_app/callback.json', { code, state });
  },

  /**
   * Start the GitHub App flow, either creating a new integration or reconnecting (replacing
   * the installation of) an existing `github_app` one.
   *
   * @param {{label?: string, integrationId?: string, mode?: string}} body - `{ label }` to
   *   create or `{ integrationId }` to reconnect, plus the optional `mode` (`install` or
   *   `connect`).
   * @returns {Promise<{redirectUrl: string}>} The GitHub URL to navigate to.
   */
  async startGithubApp({ label, integrationId, mode }) {
    return ApiClient.postJson(
      '/integrations/github_app/start.json', pickDefined({ label, integrationId, mode }),
    );
  },

  /**
   * Complete the GitHub App flow with the values GitHub sent back to the landing page.
   *
   * @param {{code: string, state: string, installationId?: number, setupAction?: string}} values
   *   - The `code` and `state` from GitHub's redirect, plus the `installationId` and
   *   `setupAction` when GitHub sent them; sent only in the request body.
   * @returns {Promise<object>} The created or reconnected integration, or
   *   `{ selection: { state, installations } }` when the user must pick an installation.
   */
  async completeGithubApp({ code, state, installationId, setupAction }) {
    return ApiClient.postJson(
      '/integrations/github_app/callback.json',
      pickDefined({ code, state, installationId, setupAction }),
    );
  },

  /**
   * Pick one installation out of a GitHub App selection.
   *
   * @param {{state: string, installationId: number}} values - The selection `state` and the
   *   chosen installation id; sent only in the request body.
   * @returns {Promise<object>} The created or reconnected integration.
   */
  async selectGithubAppInstallation({ state, installationId }) {
    return ApiClient.postJson('/integrations/github_app/select.json', { state, installationId });
  },
};

export default IntegrationsClient;
