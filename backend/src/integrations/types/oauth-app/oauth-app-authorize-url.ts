import type { EnabledOauthAppConfig } from './oauth-app-config.js';

/** GitHub's OAuth App authorize endpoint. */
export const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
// The only scope requested.
const REQUESTED_SCOPE = 'repo';

/**
 * Builds GitHub's authorize URL.
 * @param {EnabledOauthAppConfig} config - The app config.
 * @param {string} state - The opaque `state` value.
 * @param {string} codeChallenge - The PKCE `S256` challenge.
 * @returns {string} The URL.
 */
export function authorizeUrl(config: EnabledOauthAppConfig, state: string, codeChallenge: string): string {
  const query = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    scope: REQUESTED_SCOPE,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    allow_signup: 'false',
    prompt: 'select_account',
  });

  return `${GITHUB_AUTHORIZE_URL}?${query.toString()}`;
}
