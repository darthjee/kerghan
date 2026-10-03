import createRedirectLanding from './createRedirectLanding.js';

const SETUP_ACTIONS = new Set(['install', 'update']);
const POSITIVE_INTEGER = /^[1-9][0-9]*$/;

/**
 * Parse GitHub's `installation_id` / `setup_action` pair.
 *
 * @param {string|null} installationId - The raw `installation_id`, or `null` when absent.
 * @param {string|null} setupAction - The raw `setup_action`, or `null` when absent.
 * @returns {{installationId: number, setupAction: string}|object|null} Both values (install
 *   flow), an empty object (neither sent: connect flow), or `null` when they are malformed or
 *   only one of them was sent.
 */
function parseInstallation(installationId, setupAction) {
  if (installationId === null && setupAction === null) {
    return {};
  }

  if (!SETUP_ACTIONS.has(setupAction) || !POSITIVE_INTEGER.test(installationId ?? '')) {
    return null;
  }

  const id = Number(installationId);

  return Number.isSafeInteger(id) ? { installationId: id, setupAction } : null;
}

/**
 * Classify GitHub's redirect parameters into a landing result.
 *
 * @param {URLSearchParams} params - The landing URL's query parameters.
 * @returns {{kind: string}} The result: `cancelled`, `requested`, `failed`, or `callback`
 *   carrying the `code`, `state` and, for an install flow, `installationId` and `setupAction`.
 */
function classify(params) {
  const error = params.get('error');

  if (error === 'access_denied') {
    return { kind: 'cancelled' };
  }

  if (params.get('setup_action') === 'request') {
    return { kind: 'requested' };
  }

  const code = params.get('code');
  const state = params.get('state');
  const installation = parseInstallation(params.get('installation_id'), params.get('setup_action'));

  if (error || !code || !state || !installation) {
    return { kind: 'failed' };
  }

  return { kind: 'callback', code, state, ...installation };
}

/**
 * Captures the GitHub App landing
 * (`/integrations/github_app/callback?code=…&state=…[&installation_id=…&setup_action=…]`), as
 * described in `docs/agents/modules/integrations/github-app.md#landing` (see
 * {@link createRedirectLanding}). The Integrations page takes it once.
 *
 * @type {{path: string, capture: Function, take: Function}}
 */
const GithubAppLanding = createRedirectLanding('/integrations/github_app/callback', classify);

export default GithubAppLanding;
