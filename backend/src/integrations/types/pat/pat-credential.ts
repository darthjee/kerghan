import { BadRequestException } from '@nestjs/common';
import { ErrorCodes } from '../../../core/error-codes.js';
import { Secret } from '../../secret.js';

/** The PAT secret payload: the plaintext JSON encrypted into `secret_ciphertext`. */
export interface PatPayload {
  token: string;
}

/** A PAT kind, recognised by prefix only. */
export type PatTokenKind = 'classic' | 'fine_grained';

// Recognised prefixes, longest first (so `github_pat_` never matches a shorter one).
const PREFIXES: Array<{ prefix: string; kind: PatTokenKind }> = [
  { prefix: 'github_pat_', kind: 'fine_grained' },
  { prefix: 'ghp_', kind: 'classic' },
];

const MAX_TOKEN_LENGTH = 255;
const TOKEN_CHARSET = /^[A-Za-z0-9_]+$/;
// The hint shows only the last few characters of the token.
const HINT_SUFFIX_LENGTH = 4;
// U+2026 HORIZONTAL ELLIPSIS, separating the prefix from the last characters.
const ELLIPSIS = '…';

/**
 * Validates a PAT and returns the problem, if any. Messages name the field,
 * never the value.
 * @param {unknown} raw - The candidate `credential` object.
 * @returns {{ token: string } | { problem: string }} The trimmed token, or the problem.
 */
function checkCredential(raw: unknown): { token: string } | { problem: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { problem: 'credential must be an object' };
  }

  const keys = Object.keys(raw);

  if (keys.length !== 1 || keys[0] !== 'token') {
    return { problem: 'credential must contain exactly one field, token' };
  }

  return checkToken((raw as { token: unknown }).token);
}

/**
 * Validates the `token` field (string, trimmed, length, charset, prefix).
 * @param {unknown} value - The candidate token.
 * @returns {{ token: string } | { problem: string }} The trimmed token, or the problem.
 */
function checkToken(value: unknown): { token: string } | { problem: string } {
  if (typeof value !== 'string') {
    return { problem: 'credential.token must be a string' };
  }

  const token = value.trim();

  if (token.length < 1 || token.length > MAX_TOKEN_LENGTH) {
    return { problem: `credential.token must be between 1 and ${MAX_TOKEN_LENGTH} characters` };
  }

  if (!TOKEN_CHARSET.test(token)) {
    return { problem: 'credential.token must only contain letters, digits and underscores' };
  }

  if (tokenKindOf(token) === null) {
    return { problem: 'credential.token must be a GitHub personal access token' };
  }

  return { token };
}

/**
 * Validates the `credential` request object and wraps the trimmed token.
 * @param {unknown} raw - The `credential` member of the request body.
 * @returns {Secret<PatPayload>} The wrapped payload.
 */
export function parsePatCredential(raw: unknown): Secret<PatPayload> {
  const result = checkCredential(raw);

  if ('problem' in result) {
    throw new BadRequestException({ code: ErrorCodes.VALIDATION_FAILED, message: [result.problem] });
  }

  return new Secret<PatPayload>({ token: result.token });
}

/**
 * Re-validates a decrypted payload against `{ token }`.
 * @param {Secret} payload - The decrypted payload.
 * @returns {Secret<PatPayload> | null} The payload, or `null` when it doesn't match.
 */
export function parsePatPayload(payload: Secret): Secret<PatPayload> | null {
  const result = checkCredential(payload.reveal());

  return 'problem' in result ? null : new Secret<PatPayload>({ token: result.token });
}

/**
 * Recognises a PAT kind by its prefix.
 * @param {string} token - The token.
 * @returns {PatTokenKind | null} The kind, or `null` for an unsupported prefix.
 */
export function tokenKindOf(token: string): PatTokenKind | null {
  return PREFIXES.find(({ prefix }) => token.startsWith(prefix))?.kind ?? null;
}

/**
 * Builds the `secretHint`: the known prefix, `…` and the last 4 characters.
 * @param {string} token - A token that passed validation.
 * @returns {string} The hint, e.g. `ghp_…a1b2`.
 */
export function maskPatToken(token: string): string {
  const prefix = PREFIXES.find((entry) => token.startsWith(entry.prefix))?.prefix ?? '';

  return `${prefix}${ELLIPSIS}${token.slice(-HINT_SUFFIX_LENGTH)}`;
}
