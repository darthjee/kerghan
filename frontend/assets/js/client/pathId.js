import ApiError from './ApiError.js';
import { isUuid } from '../utils/ids/uuid.js';

/**
 * Turn an id into a safe request-path segment (S3).
 *
 * @description The id must be a uuid; it is also `encodeURIComponent`-ed, so no id can change
 * the request path. A malformed id throws a 404-shaped {@link ApiError} before any request is
 * made, so callers (async client methods) reject with the same error the backend would answer.
 * @param {*} id - The project or issue id.
 * @returns {string} The encoded id, ready to be put in a path.
 * @throws {ApiError} A `404` `NOT_FOUND` error when `id` is not a uuid.
 */
export default function pathId(id) {
  if (!isUuid(id)) {
    throw new ApiError(404, 'Not found', 'NOT_FOUND');
  }

  return encodeURIComponent(id);
}
