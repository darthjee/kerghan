import { isPositiveId } from '../../github-app-client.service.js';
import { Secret } from '../../secret.js';

/** The `github_app` secret payload: the plaintext JSON encrypted into `secret_ciphertext`. */
export interface GithubAppPayload {
  installationId: number;
}

// Prefix of the `secretHint`, before the ellipsis.
const HINT_PREFIX = 'installation ';
// The hint shows only the last few digits of the installation id.
const HINT_SUFFIX_LENGTH = 4;
// U+2026 HORIZONTAL ELLIPSIS, separating the prefix from the last digits.
const ELLIPSIS = '…';

/**
 * Wraps an installation id as the type's secret payload.
 * @param {number} installationId - The verified installation id.
 * @returns {Secret<GithubAppPayload>} The payload.
 */
export function githubAppPayload(installationId: number): Secret<GithubAppPayload> {
  return new Secret<GithubAppPayload>({ installationId });
}

/**
 * Re-validates a decrypted payload against `{ installationId }` (exactly
 * that key, a positive safe integer).
 * @param {Secret} payload - The decrypted payload.
 * @returns {Secret<GithubAppPayload> | null} The payload, or `null` when it doesn't match.
 */
export function parseGithubAppPayload(payload: Secret): Secret<GithubAppPayload> | null {
  const raw = payload.reveal();

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }

  const { installationId } = raw as { installationId?: unknown };

  return Object.keys(raw).length === 1 && isPositiveId(installationId) ? githubAppPayload(installationId) : null;
}

/**
 * Unwraps the installation id of a `{ installationId }` payload.
 * @param {Secret} secret - The payload.
 * @returns {number} The installation id.
 */
export function installationIdOf(secret: Secret): number {
  return (secret.reveal() as GithubAppPayload).installationId;
}

/**
 * Builds the `secretHint`: `installation …` and the last 4 digits of the id
 * (all of them when it has fewer).
 * @param {number} installationId - The installation id.
 * @returns {string} The hint, e.g. `installation …5678`.
 */
export function maskInstallationId(installationId: number): string {
  return `${HINT_PREFIX}${ELLIPSIS}${String(installationId).slice(-HINT_SUFFIX_LENGTH)}`;
}
