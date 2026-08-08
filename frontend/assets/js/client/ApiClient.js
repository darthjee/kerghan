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
    const response = await fetch(path, {
      method: 'POST',
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
