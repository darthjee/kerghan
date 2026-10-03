import type { EnabledGithubAppConfig } from './github-app-config.js';

/** GitHub's OAuth authorize endpoint (connect mode). */
export const GITHUB_APP_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';

/** How the user reaches GitHub: install the app, or only authorize it (connect existing). */
export type GithubAppMode = 'install' | 'connect';

/**
 * Builds the URL start answers with. No `scope` (a GitHub App user token gets
 * the app's permissions) and no PKCE (GitHub's installation page doesn't
 * forward it; the code is useless without the server-held client secret).
 * @param {EnabledGithubAppConfig} config - The app config.
 * @param {GithubAppMode} mode - `install` or `connect`.
 * @param {string} state - The opaque `state` value.
 * @returns {string} The redirect URL.
 */
export function githubAppRedirectUrl(config: EnabledGithubAppConfig, mode: GithubAppMode, state: string): string {
  if (mode === 'install') {
    const query = new URLSearchParams({ state });

    return `https://github.com/apps/${encodeURIComponent(config.slug)}/installations/new?${query.toString()}`;
  }

  const query = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    state,
    allow_signup: 'false',
    prompt: 'select_account',
  });

  return `${GITHUB_APP_AUTHORIZE_URL}?${query.toString()}`;
}
