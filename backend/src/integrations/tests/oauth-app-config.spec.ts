import { Secret } from '../secret.js';
import { buildOauthAppConfig, OauthAppConfig } from '../types/oauth-app/oauth-app-config.js';

const CANARY_SECRET = 'canary-client-secret-0123456789abcdef';
const CLIENT_ID = 'Ov23liAbCdEf01234567';

/**
 * Runs `buildOauthAppConfig` against a fake env.
 * @param {Record<string, string | undefined>} env - The fake env var values.
 * @returns {OauthAppConfig} The resolved config.
 */
function build(env: Record<string, string | undefined>): OauthAppConfig {
  const configService = { get: jest.fn((key: string) => env[key]) };

  return buildOauthAppConfig(configService as never);
}

/**
 * Captures the error thrown by `buildOauthAppConfig`.
 * @param {Record<string, string | undefined>} env - The fake env var values.
 * @returns {Error} The thrown error.
 */
function bootError(env: Record<string, string | undefined>): Error {
  try {
    build(env);
  } catch (error) {
    return error as Error;
  }

  throw new Error('expected buildOauthAppConfig to throw');
}

const ENABLED_ENV = {
  KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID: CLIENT_ID,
  KERGHAN_GITHUB_OAUTH_APP_CLIENT_SECRET: CANARY_SECRET,
  FRONTEND_BASE_URL: 'https://kerghan.example.com/some/path?x=1#y',
};

describe('buildOauthAppConfig', () => {
  it('is disabled when both variables are unset', () => {
    expect(build({})).toEqual({ enabled: false });
  });

  it('is disabled when both variables are blank', () => {
    expect(build({ KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID: ' ', KERGHAN_GITHUB_OAUTH_APP_CLIENT_SECRET: '  ' }))
      .toEqual({ enabled: false });
  });

  it('is enabled with the callback URL derived from the FRONTEND_BASE_URL origin', () => {
    const config = build({ ...ENABLED_ENV, KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID: `  ${CLIENT_ID}  ` });

    expect(config).toEqual({
      enabled: true,
      clientId: CLIENT_ID,
      clientSecret: expect.any(Secret),
      callbackUrl: 'https://kerghan.example.com/integrations/oauth_app/callback',
    });
    expect(config.enabled && config.clientSecret.reveal()).toBe(CANARY_SECRET);
  });

  it('accepts http outside production', () => {
    const config = build({ ...ENABLED_ENV, FRONTEND_BASE_URL: 'http://localhost:3000', NODE_ENV: 'development' });

    expect(config.enabled && config.callbackUrl).toBe('http://localhost:3000/integrations/oauth_app/callback');
  });

  it('accepts https in production', () => {
    expect(build({ ...ENABLED_ENV, NODE_ENV: 'production' }).enabled).toBe(true);
  });

  it.each([
    ['client id', { KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID: undefined }, 'KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID'],
    ['client secret', { KERGHAN_GITHUB_OAUTH_APP_CLIENT_SECRET: '' }, 'KERGHAN_GITHUB_OAUTH_APP_CLIENT_SECRET'],
  ])('fails boot when only the other variable is set (missing %s)', (_label, override, missing) => {
    const error = bootError({ ...ENABLED_ENV, ...override });

    expect(error.message).toContain(missing);
    expect(error.message).toMatch(/missing or blank/);
    expect(error.message).not.toContain(CANARY_SECRET);
    expect(error.message).not.toContain(CLIENT_ID);
  });

  it.each([
    ['a malformed client id', { KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID: 'bad id!' }, /KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID must be/],
    ['a too long client id', { KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID: 'a'.repeat(101) }, /KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID must be/],
    ['a missing FRONTEND_BASE_URL', { FRONTEND_BASE_URL: undefined }, /FRONTEND_BASE_URL must be a valid/],
    ['an unparseable FRONTEND_BASE_URL', { FRONTEND_BASE_URL: 'not a url' }, /FRONTEND_BASE_URL must be a valid/],
    ['a non-http FRONTEND_BASE_URL', { FRONTEND_BASE_URL: 'ftp://example.com' }, /FRONTEND_BASE_URL must be a valid/],
    ['http under production', { FRONTEND_BASE_URL: 'http://kerghan.example.com', NODE_ENV: 'production' }, /must be https/],
  ])('fails boot on %s', (_label, override, message) => {
    const error = bootError({ ...ENABLED_ENV, ...override });

    expect(error.message).toMatch(message);
    expect(error.message).not.toContain(CANARY_SECRET);
    expect(error.message).not.toContain('bad id!');
  });
});
