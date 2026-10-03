import { generateKeyPairSync } from 'node:crypto';
import { Secret } from '../secret.js';
import { githubAppTestKey } from './support/github-app-test-key.js';
import { buildGithubAppConfig, GithubAppConfig } from '../types/github-app/github-app-config.js';

const CANARY_SECRET = 'canary-app-client-secret-0123456789abcdef';
const CLIENT_ID = 'Iv23liAbCdEf01234567';

/**
 * Runs `buildGithubAppConfig` against a fake env.
 * @param {Record<string, string | undefined>} env - The fake env var values.
 * @returns {GithubAppConfig} The resolved config.
 */
function build(env: Record<string, string | undefined>): GithubAppConfig {
  const configService = { get: jest.fn((key: string) => env[key]) };

  return buildGithubAppConfig(configService as never);
}

/**
 * Captures the error thrown by `buildGithubAppConfig`.
 * @param {Record<string, string | undefined>} env - The fake env var values.
 * @returns {Error} The thrown error.
 */
function bootError(env: Record<string, string | undefined>): Error {
  try {
    build(env);
  } catch (error) {
    return error as Error;
  }

  throw new Error('expected buildGithubAppConfig to throw');
}

const ENABLED_ENV = (): Record<string, string | undefined> => ({
  KERGHAN_GITHUB_APP_ID: '123456',
  KERGHAN_GITHUB_APP_SLUG: 'kerghan-dev',
  KERGHAN_GITHUB_APP_PRIVATE_KEY: githubAppTestKey().base64Pem,
  KERGHAN_GITHUB_APP_CLIENT_ID: CLIENT_ID,
  KERGHAN_GITHUB_APP_CLIENT_SECRET: CANARY_SECRET,
  FRONTEND_BASE_URL: 'https://kerghan.example.com/some/path?x=1#y',
});

/**
 * Asserts an error leaks neither the key nor the secret.
 * @param {Error} error - The boot error.
 */
function expectNoSecrets(error: Error): void {
  expect(error.message).not.toContain(CANARY_SECRET);
  expect(error.message).not.toContain(githubAppTestKey().base64Pem.slice(0, 40));
  expect(error.message).not.toContain('PRIVATE KEY-----');
}

describe('buildGithubAppConfig', () => {
  it('is disabled when all variables are unset', () => {
    expect(build({ FRONTEND_BASE_URL: 'http://localhost:3000' })).toEqual({ enabled: false });
  });

  it('is disabled when all variables are blank', () => {
    expect(build({
      KERGHAN_GITHUB_APP_ID: ' ',
      KERGHAN_GITHUB_APP_SLUG: '',
      KERGHAN_GITHUB_APP_PRIVATE_KEY: '  ',
      KERGHAN_GITHUB_APP_CLIENT_ID: '',
      KERGHAN_GITHUB_APP_CLIENT_SECRET: ' ',
    })).toEqual({ enabled: false });
  });

  it('is enabled with the callback URL derived from the FRONTEND_BASE_URL origin', () => {
    const config = build({ ...ENABLED_ENV(), KERGHAN_GITHUB_APP_SLUG: '  kerghan-dev ' });

    expect(config).toEqual({
      enabled: true,
      appId: 123456,
      slug: 'kerghan-dev',
      privateKey: expect.any(Secret),
      clientId: CLIENT_ID,
      clientSecret: expect.any(Secret),
      callbackUrl: 'https://kerghan.example.com/integrations/github_app/callback',
    });
    expect(config.enabled && config.clientSecret.reveal()).toBe(CANARY_SECRET);
    expect(config.enabled && config.privateKey.reveal().asymmetricKeyType).toBe('rsa');
  });

  it('accepts http outside production', () => {
    const config = build({ ...ENABLED_ENV(), FRONTEND_BASE_URL: 'http://localhost:3000' });

    expect(config.enabled && config.callbackUrl).toBe('http://localhost:3000/integrations/github_app/callback');
  });

  it('fails boot naming every missing variable', () => {
    const error = bootError({
      ...ENABLED_ENV(),
      KERGHAN_GITHUB_APP_SLUG: undefined,
      KERGHAN_GITHUB_APP_PRIVATE_KEY: ' ',
    });

    expect(error.message).toContain('KERGHAN_GITHUB_APP_SLUG');
    expect(error.message).toContain('KERGHAN_GITHUB_APP_PRIVATE_KEY');
    expect(error.message).not.toContain('KERGHAN_GITHUB_APP_ID,');
    expectNoSecrets(error);
  });

  it.each([
    'KERGHAN_GITHUB_APP_ID',
    'KERGHAN_GITHUB_APP_SLUG',
    'KERGHAN_GITHUB_APP_PRIVATE_KEY',
    'KERGHAN_GITHUB_APP_CLIENT_ID',
    'KERGHAN_GITHUB_APP_CLIENT_SECRET',
  ])('fails boot when %s alone is missing', (variable) => {
    const error = bootError({ ...ENABLED_ENV(), [variable]: '' });

    expect(error.message).toMatch(new RegExp(`^${variable} missing or blank`));
    expectNoSecrets(error);
  });

  it.each([
    ['a non-numeric app id', { KERGHAN_GITHUB_APP_ID: '12a' }, /KERGHAN_GITHUB_APP_ID must be a positive integer/],
    ['a zero app id', { KERGHAN_GITHUB_APP_ID: '0' }, /KERGHAN_GITHUB_APP_ID must be/],
    ['an unsafe app id', { KERGHAN_GITHUB_APP_ID: '9999999999999999' }, /KERGHAN_GITHUB_APP_ID must be/],
    ['a bad slug', { KERGHAN_GITHUB_APP_SLUG: 'Kerghan_App' }, /KERGHAN_GITHUB_APP_SLUG must be/],
    ['a bad client id', { KERGHAN_GITHUB_APP_CLIENT_ID: 'bad id!' }, /KERGHAN_GITHUB_APP_CLIENT_ID must be/],
    ['an undecodable key', { KERGHAN_GITHUB_APP_PRIVATE_KEY: '!!!not-base64!!!' }, /KERGHAN_GITHUB_APP_PRIVATE_KEY must be/],
    ['a missing FRONTEND_BASE_URL', { FRONTEND_BASE_URL: undefined }, /FRONTEND_BASE_URL must be a valid/],
    ['http under production', { FRONTEND_BASE_URL: 'http://kerghan.example.com', NODE_ENV: 'production' }, /must be https/],
  ])('fails boot on %s', (_label, override, message) => {
    const error = bootError({ ...ENABLED_ENV(), ...override });

    expect(error.message).toMatch(message);
    expectNoSecrets(error);
  });

  it('fails boot on a non-RSA key', () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const error = bootError({ ...ENABLED_ENV(), KERGHAN_GITHUB_APP_PRIVATE_KEY: Buffer.from(pem).toString('base64') });

    expect(error.message).toMatch(/KERGHAN_GITHUB_APP_PRIVATE_KEY must be/);
    expectNoSecrets(error);
  });
});
