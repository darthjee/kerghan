/** The longest issue title, after trimming, in code points. */
export const MAX_TITLE_CODE_POINTS = 256;
/** The longest issue body, in code points. */
export const MAX_BODY_CODE_POINTS = 65536;

/**
 * Normalizes an issue body: exactly `''` or `null` is stored as none; every other string is kept
 * as it is (never trimmed, so a whitespace-only body stays). The single normalization function of
 * `docs/agents/specs/issues/sync.md#fields-and-ownership`, shared with the GitHub sync values.
 * @param {string | null | undefined} body - The validated body.
 * @returns {string | null} The text, or `null` for none.
 */
export function normalizeBody(body: string | null | undefined): string | null {
  return body === undefined || body === null || body === '' ? null : body;
}
