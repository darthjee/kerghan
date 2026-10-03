import { createHash, randomBytes } from 'node:crypto';
import {
  buildIntegrationsKeys,
  INTEGRATIONS_KEY_DEV_PLACEHOLDER,
  integrationsKeyIdFor,
  integrationsKeySetOf,
} from '../integrations-key.js';

const VALID_KEY = randomBytes(32).toString('base64');
const PREVIOUS_A = randomBytes(32).toString('base64');
const PREVIOUS_B = randomBytes(32).toString('base64');

/**
 * Runs `buildIntegrationsKeys` against a fake env.
 * @param {Record<string, string | undefined>} env - The fake env var values.
 * @returns {ReturnType<typeof buildIntegrationsKeys>} The resolved key set.
 */
function build(env: Record<string, string | undefined>): ReturnType<typeof buildIntegrationsKeys> {
  const configService = { get: jest.fn((key: string) => env[key]) };

  return buildIntegrationsKeys(configService as never);
}

/**
 * Runs `buildIntegrationsKeys` with a valid current key and the given previous keys.
 * @param {string | undefined} previous - The `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS` value.
 * @param {Record<string, string | undefined>} [extra] - Extra env var values.
 * @returns {ReturnType<typeof buildIntegrationsKeys>} The resolved key set.
 */
function buildWithPrevious(
  previous: string | undefined,
  extra: Record<string, string | undefined> = {},
): ReturnType<typeof buildIntegrationsKeys> {
  return build({
    KERGHAN_INTEGRATIONS_KEY: VALID_KEY,
    KERGHAN_PREVIOUS_INTEGRATIONS_KEYS: previous,
    KERGHAN_SECRET_KEY: 'other',
    ...extra,
  });
}

/**
 * Captures the error thrown by `buildIntegrationsKeys`.
 * @param {Record<string, string | undefined>} env - The fake env var values.
 * @returns {Error} The thrown error.
 */
function bootError(env: Record<string, string | undefined>): Error {
  try {
    build(env);
  } catch (error) {
    return error as Error;
  }

  throw new Error('expected buildIntegrationsKeys to throw');
}

/**
 * Base64 of raw key bytes.
 * @param {Buffer} key - The raw bytes.
 * @returns {string} The base64 value.
 */
function b64(key: Buffer): string {
  return key.toString('base64');
}

describe('buildIntegrationsKeys', () => {
  describe('current key', () => {
    it('returns the raw key bytes and their key id', () => {
      const result = build({ KERGHAN_INTEGRATIONS_KEY: VALID_KEY, KERGHAN_SECRET_KEY: 'other' });

      expect(result.current.key).toEqual(Buffer.from(VALID_KEY, 'base64'));
      expect(result.current.keyId).toBe(createHash('sha256').update(result.current.key).digest('hex').slice(0, 8));
      expect(result.byId.get(result.current.keyId)).toEqual(result.current.key);
    });

    it('accepts the placeholder outside production', () => {
      expect(build({ KERGHAN_INTEGRATIONS_KEY: INTEGRATIONS_KEY_DEV_PLACEHOLDER, NODE_ENV: 'development' }).current.key)
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
      expect(error.message).toMatch(/^KERGHAN_INTEGRATIONS_KEY /);

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

  describe('previous keys', () => {
    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['only blanks and commas', ' , ,  '],
    ])('has no previous keys when the list is %s', (_label, value) => {
      const result = buildWithPrevious(value);

      expect(result.previous).toEqual([]);
      expect([...result.byId.keys()]).toEqual([result.current.keyId]);
    });

    it('trims entries and keeps first-occurrence order', () => {
      const result = buildWithPrevious(`  ${PREVIOUS_B} ,${PREVIOUS_A}`);

      expect(result.previous.map((entry) => b64(entry.key))).toEqual([PREVIOUS_B, PREVIOUS_A]);
      expect(result.previous.map((entry) => entry.keyId))
        .toEqual([PREVIOUS_B, PREVIOUS_A].map((value) => integrationsKeyIdFor(Buffer.from(value, 'base64'))));
    });

    it('drops blank entries, duplicates and entries equal to the current key', () => {
      const result = buildWithPrevious(`${PREVIOUS_A},,${VALID_KEY}, ${PREVIOUS_A} ,${PREVIOUS_B}`);

      expect(result.previous.map((entry) => b64(entry.key))).toEqual([PREVIOUS_A, PREVIOUS_B]);
    });

    it('indexes every configured key by key id', () => {
      const result = buildWithPrevious(`${PREVIOUS_A},${PREVIOUS_B}`);

      expect(result.byId.size).toBe(3);

      for (const entry of [result.current, ...result.previous]) {
        expect(result.byId.get(entry.keyId)).toEqual(entry.key);
      }
    });

    it.each([
      ['not base64', 'not*base64!!not*base64!!not*base64!!not*bas', /valid base64/],
      ['not canonical base64', `${PREVIOUS_B.slice(0, 20)}=${PREVIOUS_B.slice(20)}`, /valid base64/],
      ['31 bytes', randomBytes(31).toString('base64'), /exactly 32 bytes/],
      ['33 bytes', randomBytes(33).toString('base64'), /exactly 32 bytes/],
    ])('fails boot when an entry is %s, naming its position', (_label, value, message) => {
      const error = bootError({
        KERGHAN_INTEGRATIONS_KEY: VALID_KEY,
        KERGHAN_PREVIOUS_INTEGRATIONS_KEYS: `${PREVIOUS_A},,${value}`,
        KERGHAN_SECRET_KEY: 'other',
      });

      expect(error.message).toMatch(message);
      expect(error.message).toMatch(/^KERGHAN_PREVIOUS_INTEGRATIONS_KEYS entry 3 /);
      expect(error.message).not.toContain(value);
      expect(error.message).not.toContain(PREVIOUS_A);
    });

    it('fails boot when an entry equals KERGHAN_SECRET_KEY', () => {
      const error = bootError({
        KERGHAN_INTEGRATIONS_KEY: VALID_KEY,
        KERGHAN_PREVIOUS_INTEGRATIONS_KEYS: PREVIOUS_A,
        KERGHAN_SECRET_KEY: PREVIOUS_A,
      });

      expect(error.message).toMatch(/^KERGHAN_PREVIOUS_INTEGRATIONS_KEYS entry 1 must differ from KERGHAN_SECRET_KEY/);
      expect(error.message).not.toContain(PREVIOUS_A);
    });

    it('fails boot on the placeholder in production', () => {
      const error = bootError({
        KERGHAN_INTEGRATIONS_KEY: VALID_KEY,
        KERGHAN_PREVIOUS_INTEGRATIONS_KEYS: `${PREVIOUS_A},${INTEGRATIONS_KEY_DEV_PLACEHOLDER}`,
        NODE_ENV: 'production',
      });

      expect(error.message).toMatch(/^KERGHAN_PREVIOUS_INTEGRATIONS_KEYS entry 2 .*placeholder in production/);
      expect(error.message).not.toContain(INTEGRATIONS_KEY_DEV_PLACEHOLDER);
    });

    it('accepts the placeholder as a previous key outside production', () => {
      const result = buildWithPrevious(INTEGRATIONS_KEY_DEV_PLACEHOLDER, { NODE_ENV: 'development' });

      expect(result.previous).toHaveLength(1);
    });
  });
});

describe('integrationsKeySetOf', () => {
  it('builds the key set from raw bytes', () => {
    const current = randomBytes(32);
    const previous = randomBytes(32);
    const set = integrationsKeySetOf(current, [previous]);

    expect(set.current).toEqual({ key: current, keyId: integrationsKeyIdFor(current) });
    expect(set.previous).toEqual([{ key: previous, keyId: integrationsKeyIdFor(previous) }]);
    expect(set.byId.get(integrationsKeyIdFor(previous))).toBe(previous);
  });

  it('fails boot when two keys share a key id, naming the id and never a key', () => {
    const key = randomBytes(32);
    const other = randomBytes(32);
    const keyId = integrationsKeyIdFor(key);

    expect(() => integrationsKeySetOf(key, [other, Buffer.from(key)]))
      .toThrow(`KERGHAN_PREVIOUS_INTEGRATIONS_KEYS holds two keys sharing the key id ${keyId}`);
  });

  it('defaults to no previous keys', () => {
    expect(integrationsKeySetOf(randomBytes(32)).previous).toEqual([]);
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
