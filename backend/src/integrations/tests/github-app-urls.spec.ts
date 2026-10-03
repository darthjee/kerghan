import { enabledGithubAppConfig, TEST_APP_CALLBACK_URL, TEST_APP_CLIENT_ID } from './support/github-app-test-config.js';
import { githubAppRedirectUrl } from '../types/github-app/github-app-urls.js';

const STATE = '0b6c1f8e-3a52-4c1b-9d5a-6f2e7c8d9a10.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

describe('githubAppRedirectUrl', () => {
  const config = enabledGithubAppConfig();

  it('builds the installation page URL with only the state', () => {
    const url = githubAppRedirectUrl(config, 'install', STATE);

    expect(url).toMatch(/^https:\/\/github\.com\/apps\/[a-z0-9-]+\/installations\/new\?/);
    expect(url).toBe(`https://github.com/apps/kerghan-test/installations/new?state=${encodeURIComponent(STATE)}`);
  });

  it('builds the authorize URL for connect mode, without scope or PKCE', () => {
    const url = new URL(githubAppRedirectUrl(config, 'connect', STATE));

    expect(url.href.startsWith('https://github.com/login/oauth/authorize?')).toBe(true);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: TEST_APP_CLIENT_ID,
      redirect_uri: TEST_APP_CALLBACK_URL,
      state: STATE,
      allow_signup: 'false',
      prompt: 'select_account',
    });
  });
});
