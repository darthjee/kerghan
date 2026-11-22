/** Pattern of a uuid (any version), as the backend's `ParseUUIDPipe` accepts it. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check that a value is a well-formed uuid.
 *
 * @description Ids taken from the hash, or from `error.meta`, are checked with this before any
 * request path or link is built (S3), so a malformed id shows "not found" with no call.
 * @param {*} value - The value to check.
 * @returns {boolean} `true` only for a string in the canonical 8-4-4-4-12 hex form.
 */
export function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
