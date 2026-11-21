/** The longest project name, after trimming, in code points. */
export const MAX_NAME_CODE_POINTS = 100;
/** The longest project description, after trimming, in code points. */
export const MAX_DESCRIPTION_CODE_POINTS = 2000;

/**
 * Normalizes a validated description: blank or `null` is stored as none.
 * @param {string | null | undefined} description - The validated, trimmed description.
 * @returns {string | null} The text, or `null` for none.
 */
export function normalizeDescription(description: string | null | undefined): string | null {
  return description === undefined || description === null || description === '' ? null : description;
}
