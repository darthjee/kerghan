import { createHash, randomBytes } from 'node:crypto';
import {
  buildIntegrationsKey,
  INTEGRATIONS_KEY_DEV_PLACEHOLDER,
  integrationsKeyIdFor,
} from '../integrations-key.js';

const VALID_KEY = randomBytes(32).toString('base64');

/**
 * Runs `buildIntegrationsKey` against a fake env.
 * @param {Record<string, string | undefined>} env - The fake env var values.
 * @returns {ReturnType<typeof buildIntegrationsKey>} The resolved key.
 */
function build(env: Record<string, string | undefined>): ReturnType<typeof buildIntegrationsKey> {
  const configService = { get: jest.fn((key: string) => env[key]) };

  return buildIntegrationsKey(configService as never);
}

/**
 * Captures the error thrown by `buildIntegrationsKey`.
 * @param {Record<string, string | undefined>} env - The fake env var values.
 * @returns {Error} The thrown error.
 */
function bootError(env: Record<string, string | undefined>): Error {
  try {
    build(env);
  } catch (error) {
    return error as Error;
  }

  throw new Error('expected buildIntegrationsKey to throw');
}

describe('buildIntegrationsKey', () => {
  it('returns the raw key bytes and their key id', () => {
    const result = build({ KERGHAN_INTEGRATIONS_KEY: VALID_KEY, KERGHAN_SECRET_KEY: 'other' });

    expect(result.key).toEqual(Buffer.from(VALID_KEY, 'base64'));
    expect(result.keyId).toBe(createHash('sha256').update(result.key).digest('hex').slice(0, 8));
  });

  it('accepts the placeholder outside production', () => {
    expect(build({ KERGHAN_INTEGRATIONS_KEY: INTEGRATIONS_KEY_DEV_PLACEHOLDER, NODE_ENV: 'development' }).key)
      .toEqual(Buffer.from('kerghan-dev-integrations-key-32b', 'ascii'));
  });

  it('accepts the placeholder when NODE_ENV is unset', () => {
    expect(() => build({ KERGHAN_INTEGRATIONS_KEY: INTEGRATIONS_KEY_DEV_PLACEHOLDER })).not.toThrow();
  });

  it.each([
    ['missing', undefined, /missing or blank/],
    ['blank', '   ', /missing or blank/],
    ['not base64', 'not*base64!!not*base64!!not*base64!!not*bas', /valid base64/],
    ['leniently decodable but not canonical base64', `${VALID_KEY.slice(0, 20)}\n${VALID_KEY.slice(20)}`, /valid base64/],
    ['31 bytes', randomBytes(31).toString('base64'), /exactly 32 bytes/],
    ['33 bytes', randomBytes(33).toString('base64'), /exactly 32 bytes/],
  ])('fails boot when the key is %s', (_label, value, message) => {
    const error = bootError({ KERGHAN_INTEGRATIONS_KEY: value, KERGHAN_SECRET_KEY: 'other' });

    expect(error.message).toMatch(message);
    expect(error.message).toContain('KERGHAN_INTEGRATIONS_KEY');

    if (value !== undefined && value.trim() !== '') {
      expect(error.message).not.toContain(value);
    }
  });

  it('fails boot when the key equals KERGHAN_SECRET_KEY', () => {
    const error = bootError({ KERGHAN_INTEGRATIONS_KEY: VALID_KEY, KERGHAN_SECRET_KEY: VALID_KEY });

    expect(error.message).toMatch(/must differ from KERGHAN_SECRET_KEY/);
    expect(error.message).not.toContain(VALID_KEY);
  });

  it('fails boot on the placeholder in production', () => {
    const error = bootError({ KERGHAN_INTEGRATIONS_KEY: INTEGRATIONS_KEY_DEV_PLACEHOLDER, NODE_ENV: 'production' });

    expect(error.message).toMatch(/placeholder in production/);
    expect(error.message).not.toContain(INTEGRATIONS_KEY_DEV_PLACEHOLDER);
  });

  it('accepts a real key in production', () => {
    expect(() => build({ KERGHAN_INTEGRATIONS_KEY: VALID_KEY, NODE_ENV: 'production' })).not.toThrow();
  });
});

describe('integrationsKeyIdFor', () => {
  it('is the first 8 hex characters of SHA-256 over the raw key', () => {
    const key = Buffer.from('kerghan-dev-integrations-key-32b', 'ascii');
    const reference = createHash('sha256').update(key).digest('hex').slice(0, 8);

    expect(integrationsKeyIdFor(key)).toBe(reference);
    expect(integrationsKeyIdFor(key)).toMatch(/^[0-9a-f]{8}$/);
  });
});
