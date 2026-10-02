import type { PatTokenKind } from './pat-credential.js';
import { InvalidMetadataError } from '../../integration-errors.js';

/** The `pat` metadata shape. */
export interface PatMetadata {
  tokenKind: PatTokenKind;
  scopes: string[] | null;
  permissionsVerified: boolean;
  [key: string]: unknown;
}

const MAX_SCOPES = 50;
const MAX_SCOPE_LENGTH = 64;
const METADATA_KEYS = ['permissionsVerified', 'scopes', 'tokenKind'];
// e.g. `2026-11-01 00:00:00 UTC` or `2026-11-01 00:00:00 -0800`.
const EXPIRATION_PATTERN = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) (UTC|[+-]\d{2}\d{2})$/;

/**
 * Parses an `X-OAuth-Scopes` header: split on `,`, trimmed, empty entries
 * dropped, sorted and de-duplicated, bounded to 50 entries of at most 64
 * characters. A missing or empty header means no scopes.
 * @param {string | null} header - The raw header.
 * @returns {string[]} The scopes.
 */
export function parseScopes(header: string | null): string[] {
  const scopes = (header ?? '')
    .split(',')
    .map((scope) => scope.trim())
    .filter((scope) => scope !== '' && scope.length <= MAX_SCOPE_LENGTH);

  return [...new Set(scopes)].sort().slice(0, MAX_SCOPES);
}

/**
 * Parses GitHub's `GitHub-Authentication-Token-Expiration` header into a UTC date.
 * @param {string | null} header - The raw header (`YYYY-MM-DD HH:MM:SS UTC` or `... ±HHMM`).
 * @returns {Date | null | undefined} The date; `null` when absent; `undefined` when unparseable.
 */
export function parseExpiration(header: string | null): Date | null | undefined {
  if (header === null || header.trim() === '') {
    return null;
  }

  const match = EXPIRATION_PATTERN.exec(header.trim());

  if (match === null) {
    return undefined;
  }

  const [, date, time, zone] = match;
  const offset = zone === 'UTC' ? 'Z' : `${zone.slice(0, 3)}:${zone.slice(3)}`;
  const parsed = new Date(`${date}T${time}${offset}`);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Builds the metadata for a validated token.
 * @param {PatTokenKind} tokenKind - The token kind.
 * @param {string | null} scopesHeader - The raw `X-OAuth-Scopes` header.
 * @returns {PatMetadata} Classic: parsed scopes, verified; fine-grained: `null` scopes, unverified.
 */
export function buildPatMetadata(tokenKind: PatTokenKind, scopesHeader: string | null): PatMetadata {
  return tokenKind === 'classic'
    ? { tokenKind, scopes: parseScopes(scopesHeader), permissionsVerified: true }
    : { tokenKind, scopes: null, permissionsVerified: false };
}

/**
 * Validates the strict three-key `pat` metadata shape.
 * @param {unknown} metadata - The candidate metadata.
 * @returns {PatMetadata} A normalised copy.
 */
export function describePatMetadata(metadata: unknown): PatMetadata {
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    throw new InvalidMetadataError('pat');
  }

  const candidate = metadata as Record<string, unknown>;
  const keys = Object.keys(candidate).sort();

  if (keys.join(',') !== METADATA_KEYS.join(',') || !isConsistent(candidate)) {
    throw new InvalidMetadataError('pat');
  }

  const { tokenKind, scopes, permissionsVerified } = candidate as PatMetadata;

  return { tokenKind, scopes: scopes === null ? null : [...scopes], permissionsVerified };
}

/**
 * Checks the kind-dependent rules: classic has a scope list and is verified;
 * fine-grained has `null` scopes and is unverified.
 * @param {Record<string, unknown>} metadata - The candidate metadata.
 * @returns {boolean} Whether the values are consistent.
 */
function isConsistent(metadata: Record<string, unknown>): boolean {
  const { tokenKind, scopes, permissionsVerified } = metadata;

  if (tokenKind === 'classic') {
    return permissionsVerified === true && isScopeList(scopes);
  }

  return tokenKind === 'fine_grained' && permissionsVerified === false && scopes === null;
}

/**
 * Whether a value is a bounded list of scope names.
 * @param {unknown} scopes - The candidate scopes.
 * @returns {boolean} `true` for at most 50 strings of 1–64 characters.
 */
function isScopeList(scopes: unknown): scopes is string[] {
  return Array.isArray(scopes)
    && scopes.length <= MAX_SCOPES
    && scopes.every((scope) => typeof scope === 'string' && scope !== '' && scope.length <= MAX_SCOPE_LENGTH);
}
