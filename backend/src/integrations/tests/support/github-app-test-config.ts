import { FAKE_APP_ID } from './fake-github-answers.js';
import { githubAppTestKey } from './github-app-test-key.js';
import { Secret } from '../../secret.js';
import type { EnabledGithubAppConfig } from '../../types/github-app/github-app-config.js';

/** A recognisable GitHub App client secret that must never leak anywhere. */
export const CANARY_APP_CLIENT_SECRET = 'CANARYcanaryAPPSECRET0123456789abcdef0123';
/** The test GitHub App client id. */
export const TEST_APP_CLIENT_ID = 'Iv23liTestClient0001';
/** The test GitHub App slug. */
export const TEST_APP_SLUG = 'kerghan-test';
/** The test callback URL. */
export const TEST_APP_CALLBACK_URL = 'https://kerghan.example.com/integrations/github_app/callback';

/**
 * An enabled GitHub App config over the test-only RSA key.
 * @param {Partial<EnabledGithubAppConfig>} overrides - Fields to override.
 * @returns {EnabledGithubAppConfig} The config.
 */
export function enabledGithubAppConfig(overrides: Partial<EnabledGithubAppConfig> = {}): EnabledGithubAppConfig {
  return {
    enabled: true,
    appId: FAKE_APP_ID,
    slug: TEST_APP_SLUG,
    privateKey: new Secret(githubAppTestKey().privateKey),
    clientId: TEST_APP_CLIENT_ID,
    clientSecret: new Secret(CANARY_APP_CLIENT_SECRET),
    callbackUrl: TEST_APP_CALLBACK_URL,
    ...overrides,
  };
}
