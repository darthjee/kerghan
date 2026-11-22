import { codePointLength } from './projectValidators.js';

/** Longest issue title, in code points; mirrors the backend's limit. */
export const MAX_ISSUE_TITLE_LENGTH = 256;

/** Longest issue body, in code points; mirrors the backend's limit. */
export const MAX_ISSUE_BODY_LENGTH = 65536;

/**
 * Check an issue title: required, and at most {@link MAX_ISSUE_TITLE_LENGTH} trimmed code
 * points. The server stays authoritative.
 *
 * @description Returns an error map so the result can be spread into a controller's errors.
 * @param {string} title - The title value (trimmed here).
 * @param {string} [field] - The field name the error is keyed under.
 * @returns {object} `{ [field]: message }` when invalid, otherwise `{}`.
 */
export function validateIssueTitle(title, field = 'title') {
  const length = codePointLength(title.trim());

  if (length === 0) {
    return { [field]: 'Title is required' };
  }

  if (length > MAX_ISSUE_TITLE_LENGTH) {
    return { [field]: `Title must be at most ${MAX_ISSUE_TITLE_LENGTH} characters` };
  }

  return {};
}

/**
 * Check an issue body: optional, at most {@link MAX_ISSUE_BODY_LENGTH} code points. The body is
 * never trimmed.
 *
 * @description Returns an error map so the result can be spread into a controller's errors.
 * @param {string} body - The body value (counted as typed).
 * @param {string} [field] - The field name the error is keyed under.
 * @returns {object} `{ [field]: message }` when too long, otherwise `{}`.
 */
export function validateIssueBody(body, field = 'body') {
  if (codePointLength(body) <= MAX_ISSUE_BODY_LENGTH) {
    return {};
  }

  return { [field]: `Body must be at most ${MAX_ISSUE_BODY_LENGTH} characters` };
}
