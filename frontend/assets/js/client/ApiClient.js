import ApiError from './ApiError.js';

/**
 * Generic JSON HTTP client used by resource-specific clients.
 */
export default class ApiClient {
  /**
   * Submit a POST request with a JSON body. Always sends same-origin credentials so the
   * session cookie set by the backend (via `Set-Cookie`) is stored/sent automatically.
   *
   * @param {string} path - Request path.
   * @param {object} body - Fields to serialize as the JSON request body.
   * @returns {Promise<object>} The parsed JSON response body, on success.
   */
  static async postJson(path, body) {
    return ApiClient.#sendJson('POST', path, body);
  }

  /**
   * Submit a DELETE request with a JSON body. Same headers/credentials/error-handling shape
   * as {@link ApiClient.postJson}.
   *
   * @param {string} path - Request path.
   * @param {object} body - Fields to serialize as the JSON request body.
   * @returns {Promise<object>} The parsed JSON response body, on success.
   */
  static async deleteJson(path, body) {
    return ApiClient.#sendJson('DELETE', path, body);
  }

  /**
   * Submit a JSON request, always sending same-origin credentials so the session cookie set
   * by the backend (via `Set-Cookie`) is stored/sent automatically.
   *
   * @param {string} method - HTTP method.
   * @param {string} path - Request path.
   * @param {object} body - Fields to serialize as the JSON request body.
   * @returns {Promise<object>} The parsed JSON response body, on success.
   */
  static async #sendJson(method, path, body) {
    const response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(response.status, data.error);
    }

    return data;
  }
}
