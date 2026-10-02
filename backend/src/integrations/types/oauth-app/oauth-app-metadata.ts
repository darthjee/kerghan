import { OAUTH_APP_CLIENT_ID_PATTERN } from './oauth-app-config.js';
import { InvalidMetadataError } from '../../integration-errors.js';
import { parseScopes } from '../pat/pat-metadata.js';

/** The `oauth_app` metadata shape. */
export interface OauthAppMetadata {
  scopes: string[];
  clientId: string;
  [key: string]: unknown;
}

const MAX_SCOPES = 50;
const MAX_SCOPE_LENGTH = 64;
const METADATA_KEYS = ['clientId', 'scopes'];

/**
 * Builds the metadata of a token checked with `GET /user`.
 * @param {string | null} scopesHeader - The raw `X-OAuth-Scopes` header.
 * @param {string} clientId - The OAuth App client id the token was issued to.
 * @returns {OauthAppMetadata} The metadata.
 */
export function buildOauthAppMetadata(scopesHeader: string | null, clientId: string): OauthAppMetadata {
  return { scopes: parseScopes(scopesHeader), clientId };
}

/**
 * Validates the strict two-key `oauth_app` metadata shape, returning a copy
 * with the scopes sorted and de-duplicated. It never holds anything usable
 * as a credential.
 * @param {unknown} metadata - The candidate metadata.
 * @returns {OauthAppMetadata} A normalised copy.
 */
export function describeOauthAppMetadata(metadata: unknown): OauthAppMetadata {
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    throw new InvalidMetadataError('oauth_app');
  }

  const candidate = metadata as Record<string, unknown>;
  const { scopes, clientId } = candidate;

  if (Object.keys(candidate).sort().join(',') !== METADATA_KEYS.join(',')
    || !isScopeList(scopes)
    || typeof clientId !== 'string'
    || !OAUTH_APP_CLIENT_ID_PATTERN.test(clientId)) {
    throw new InvalidMetadataError('oauth_app');
  }

  return { scopes: [...new Set(scopes)].sort(), clientId };
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
