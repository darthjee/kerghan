import { verify } from 'node:crypto';
import { Secret } from '../secret.js';
import { githubAppTestKey } from './support/github-app-test-key.js';
import { mintAppJwt } from '../types/github-app/github-app-jwt.js';

const CLIENT_ID = 'Iv23liAbCdEf01234567';
const NOW_MS = 1_700_000_000_123;

/**
 * Decodes one base64url JSON segment.
 * @param {string} segment - The segment.
 * @returns {Record<string, unknown>} The decoded JSON.
 */
function decode(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as Record<string, unknown>;
}

describe('mintAppJwt', () => {
  const key = githubAppTestKey();
  const mint = (now = NOW_MS): string => mintAppJwt(new Secret(key.privateKey), CLIENT_ID, now).reveal();

  it('is wrapped in a Secret', () => {
    expect(String(mintAppJwt(new Secret(key.privateKey), CLIENT_ID, NOW_MS))).toBe('[REDACTED]');
  });

  it('has an RS256 header and the specified claims', () => {
    const [header, payload] = mint().split('.');

    expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(decode(payload)).toEqual({ iat: 1_700_000_000 - 60, exp: 1_700_000_000 + 540, iss: CLIENT_ID });
  });

  it('is verifiable with the public half of the key', () => {
    const [header, payload, signature] = mint().split('.');

    expect(verify('sha256', Buffer.from(`${header}.${payload}`), key.publicKey, Buffer.from(signature, 'base64url')))
      .toBe(true);
  });

  it('mints a fresh JWT per call', () => {
    expect(mint(NOW_MS)).not.toBe(mint(NOW_MS + 1000));
  });

  it('defaults to the current time', () => {
    const before = Math.floor(Date.now() / 1000);
    const [, payload] = mintAppJwt(new Secret(key.privateKey), CLIENT_ID).reveal().split('.');

    expect(decode(payload).iat).toBeGreaterThanOrEqual(before - 60);
  });
});
