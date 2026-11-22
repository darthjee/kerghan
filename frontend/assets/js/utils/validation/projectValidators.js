/** Longest project name, in code points; mirrors the backend's limit. */
export const MAX_PROJECT_NAME_LENGTH = 100;

/** Longest project description, in code points; mirrors the backend's limit. */
export const MAX_PROJECT_DESCRIPTION_LENGTH = 2000;

/**
 * Count the code points of a text (a 4-byte character counts once).
 *
 * @param {string} text - The text.
 * @returns {number} The number of code points.
 */
export function codePointLength(text) {
  return Array.from(text).length;
}

/**
 * Check a project name: required, and at most {@link MAX_PROJECT_NAME_LENGTH} trimmed code
 * points. The server stays authoritative.
 *
 * @description Returns an error map so the result can be spread into a controller's errors.
 * @param {string} name - The name value (trimmed here).
 * @param {string} [field] - The field name the error is keyed under.
 * @returns {object} `{ [field]: message }` when invalid, otherwise `{}`.
 */
export function validateProjectName(name, field = 'name') {
  const length = codePointLength(name.trim());

  if (length === 0) {
    return { [field]: 'Name is required' };
  }

  if (length > MAX_PROJECT_NAME_LENGTH) {
    return { [field]: `Name must be at most ${MAX_PROJECT_NAME_LENGTH} characters` };
  }

  return {};
}

/**
 * Check a project description: optional, at most {@link MAX_PROJECT_DESCRIPTION_LENGTH}
 * trimmed code points.
 *
 * @description Returns an error map so the result can be spread into a controller's errors.
 * @param {string} description - The description value (trimmed here).
 * @param {string} [field] - The field name the error is keyed under.
 * @returns {object} `{ [field]: message }` when too long, otherwise `{}`.
 */
export function validateProjectDescription(description, field = 'description') {
  if (codePointLength(description.trim()) <= MAX_PROJECT_DESCRIPTION_LENGTH) {
    return {};
  }

  return { [field]: `Description must be at most ${MAX_PROJECT_DESCRIPTION_LENGTH} characters` };
}
