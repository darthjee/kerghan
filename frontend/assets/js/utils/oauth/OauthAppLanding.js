import createRedirectLanding from './createRedirectLanding.js';

/**
 * Classify GitHub's redirect parameters into a landing result.
 *
 * @param {URLSearchParams} params - The landing URL's query parameters.
 * @returns {{kind: string, code: (string|undefined), state: (string|undefined)}} The result:
 *   `cancelled`, `failed`, or `callback` carrying the `code` and `state`.
 */
function classify(params) {
  const error = params.get('error');

  if (error === 'access_denied') {
    return { kind: 'cancelled' };
  }

  const code = params.get('code');
  const state = params.get('state');

  if (error || !code || !state) {
    return { kind: 'failed' };
  }

  return { kind: 'callback', code, state };
}

/**
 * Captures the OAuth App landing (`/integrations/oauth_app/callback?code=…&state=…`), as
 * described in `docs/agents/specs/integrations/types/oauth-app.md#landing` (see
 * {@link createRedirectLanding}). The Integrations page takes it once.
 *
 * @type {{path: string, capture: Function, take: Function}}
 */
const OauthAppLanding = createRedirectLanding('/integrations/oauth_app/callback', classify);

export default OauthAppLanding;
