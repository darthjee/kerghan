/** The source key of the GitHub handle's public repositories. */
export const HANDLE_SOURCE_KEY = 'handle';

const INTEGRATION_PREFIX = 'integration:';
const INTEGRATION_KEY = /^integration:([1-9][0-9]*)$/;

/** A parsed source key. */
export type ParsedSourceKey = { kind: 'handle' } | { kind: 'integration'; integrationId: number };

/**
 * The source key of an integration (`integration:<id>`), see
 * `docs/agents/modules/repositories.md#tables`.
 * @param {number} integrationId - The internal `integrations.id`.
 * @returns {string} The source key.
 */
export function integrationSourceKey(integrationId: number): string {
  return `${INTEGRATION_PREFIX}${integrationId}`;
}

/**
 * Parses a stored source key.
 * @param {string} key - The stored `source_key`.
 * @returns {ParsedSourceKey | null} The parsed key, or `null` when it is not a known shape.
 */
export function parseSourceKey(key: string): ParsedSourceKey | null {
  if (key === HANDLE_SOURCE_KEY) return { kind: 'handle' };

  const match = INTEGRATION_KEY.exec(key);

  return match === null ? null : { kind: 'integration', integrationId: Number(match[1]) };
}
