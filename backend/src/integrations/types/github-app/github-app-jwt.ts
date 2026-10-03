import { KeyObject, sign } from 'node:crypto';
import { Secret } from '../../secret.js';

// How far back `iat` is set, to absorb clock drift (GitHub's recommendation).
export const APP_JWT_BACKDATE_SECONDS = 60;
// How long the JWT lives (GitHub's maximum is 10 minutes).
export const APP_JWT_LIFETIME_SECONDS = 9 * 60;

/**
 * Encodes a JSON value as unpadded base64url.
 * @param {unknown} value - The value to encode.
 * @returns {string} The base64url text.
 */
function encodeSegment(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/**
 * Mints a GitHub App JWT: RS256, `iat` = now − 60 s, `exp` = now + 9 min,
 * `iss` = the app's client id (GitHub's current recommendation; it also
 * accepts the app id). Minted per call, wrapped in a `Secret`, never stored
 * or logged.
 * @param {Secret<KeyObject>} privateKey - The app's RSA private key.
 * @param {string} clientId - The app's client id, used as `iss`.
 * @param {number} nowMs - The current time, in milliseconds.
 * @returns {Secret<string>} The signed JWT.
 */
export function mintAppJwt(privateKey: Secret<KeyObject>, clientId: string, nowMs: number = Date.now()): Secret<string> {
  const now = Math.floor(nowMs / 1000);
  const header = encodeSegment({ alg: 'RS256', typ: 'JWT' });
  const payload = encodeSegment({
    iat: now - APP_JWT_BACKDATE_SECONDS,
    exp: now + APP_JWT_LIFETIME_SECONDS,
    iss: clientId,
  });
  const signingInput = `${header}.${payload}`;
  const signature = sign('sha256', Buffer.from(signingInput), privateKey.reveal()).toString('base64url');

  return new Secret(`${signingInput}.${signature}`);
}
