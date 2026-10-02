import { Secret } from '../../secret.js';

/** The `oauth_app` secret payload: the plaintext JSON encrypted into `secret_ciphertext`. */
export interface OauthAppPayload {
  token: string;
}

/** What `OauthAppStrategy#validate` receives: the callback's code and the flow's PKCE verifier. */
export interface OauthAppCodePayload {
  code: string;
  codeVerifier: string;
}

/** Prefix of every OAuth App user access token. */
export const OAUTH_APP_TOKEN_PREFIX = 'gho_';
// The hint shows only the last few characters of the token.
const HINT_SUFFIX_LENGTH = 4;
// U+2026 HORIZONTAL ELLIPSIS, separating the prefix from the last characters.
const ELLIPSIS = '…';

/**
 * Whether a value is an OAuth App user access token (a string starting with `gho_`).
 * @param {unknown} token - The candidate token.
 * @returns {boolean} Whether it is one.
 */
export function isOauthAppToken(token: unknown): token is string {
  return typeof token === 'string' && token.startsWith(OAUTH_APP_TOKEN_PREFIX)
    && token.length > OAUTH_APP_TOKEN_PREFIX.length;
}

/**
 * Re-validates a decrypted payload against `{ token }` (exactly that key, a `gho_` token).
 * @param {Secret} payload - The decrypted payload.
 * @returns {Secret<OauthAppPayload> | null} The payload, or `null` when it doesn't match.
 */
export function parseOauthAppPayload(payload: Secret): Secret<OauthAppPayload> | null {
  const raw = payload.reveal();

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }

  const keys = Object.keys(raw);
  const { token } = raw as { token?: unknown };

  return keys.length === 1 && isOauthAppToken(token) ? new Secret<OauthAppPayload>({ token }) : null;
}

/**
 * Builds the `secretHint`: `gho_`, `…` and the last 4 characters.
 * @param {string} token - A validated token.
 * @returns {string} The hint, e.g. `gho_…a1b2`.
 */
export function maskOauthAppToken(token: string): string {
  return `${OAUTH_APP_TOKEN_PREFIX}${ELLIPSIS}${token.slice(-HINT_SUFFIX_LENGTH)}`;
}

/**
 * Unwraps the token of a `{ token }` payload.
 * @param {Secret} secret - The payload.
 * @returns {string} The token.
 */
export function oauthAppTokenOf(secret: Secret): string {
  return (secret.reveal() as OauthAppPayload).token;
}
