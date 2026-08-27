import ApiError from './ApiError.js';
import AuthSession from './AuthSession.js';

const REFRESH_PATH = '/auth/refresh.json';
const LOGIN_HASH = '/login';

/**
 * Generic JSON HTTP client used by resource-specific clients. Transparently recovers from an
 * expired access token: on a `401`, it refreshes the session once (via the stored refresh
 * token) and retries the original request; if there is no refresh token to use, or the
 * refresh itself fails, the session is treated as expired.
 */
export default class ApiClient {
  /**
   * Submit a POST request with a JSON body. Always sends same-origin credentials so the
   * session cookie set by the backend (via `Set-Cookie`) is stored/sent automatically.
   *
   * @param {string} path - Request path.
   * @param {object} body - Fields to serialize as the JSON request body.
   * @returns {Promise<object>} The parsed JSON response body, on success; `undefined` when the
   *   session turned out to be expired.
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
   * @returns {Promise<object>} The parsed JSON response body, on success; `undefined` when the
   *   session turned out to be expired.
   */
  static async deleteJson(path, body) {
    return ApiClient.#sendJson('DELETE', path, body);
  }

  /**
   * Submit a JSON request, always sending same-origin credentials so the session cookie set
   * by the backend (via `Set-Cookie`) is stored/sent automatically. On a `401`, delegates to
   * {@link ApiClient.#handleUnauthorized} unless this is already a retried request, in which
   * case the session is treated as expired directly.
   *
   * @param {string} method - HTTP method.
   * @param {string} path - Request path.
   * @param {object} body - Fields to serialize as the JSON request body.
   * @param {boolean} [isRetry] - Whether this call is already a post-refresh retry.
   * @returns {Promise<object>} The parsed JSON response body, on success; `undefined` when the
   *   session turned out to be expired.
   */
  static async #sendJson(method, path, body, isRetry = false) {
    const { response, data } = await ApiClient.#request(method, path, body);

    if (response.ok) {
      return data;
    }

    if (response.status === 401) {
      return isRetry
        ? ApiClient.#sessionExpired()
        : ApiClient.#handleUnauthorized(method, path, body);
    }

    throw new ApiError(response.status, data.error);
  }

  /**
   * Recover from a `401` on the original request: refresh the access token using the stored
   * refresh token and retry the original request once. Falls back to session-expired handling
   * when there is no stored refresh token, or when the refresh call itself fails.
   *
   * @param {string} method - Original request's HTTP method.
   * @param {string} path - Original request's path.
   * @param {object} body - Original request's JSON body.
   * @returns {Promise<object>} The retried request's parsed JSON body, on success; `undefined`
   *   when the session turned out to be expired.
   */
  static async #handleUnauthorized(method, path, body) {
    const refreshToken = AuthSession.get();

    if (!refreshToken) {
      return ApiClient.#sessionExpired();
    }

    const refreshResponse = await ApiClient.#request('POST', REFRESH_PATH, { refreshToken });

    if (!refreshResponse.response.ok) {
      return ApiClient.#sessionExpired();
    }

    AuthSession.set(refreshResponse.data.refreshToken);

    return ApiClient.#sendJson(method, path, body, true);
  }

  /**
   * Perform a raw JSON request, without any `401`-recovery behavior.
   *
   * @param {string} method - HTTP method.
   * @param {string} path - Request path.
   * @param {object} body - Fields to serialize as the JSON request body.
   * @returns {Promise<{response: Response, data: object}>} The raw response and its parsed
   *   JSON body.
   */
  static async #request(method, path, body) {
    const response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return { response, data };
  }

  /**
   * End the client-side session: clear the stored refresh token and redirect to the login
   * route. SSR/spec-safe — a no-op when `window` is not defined, the same way
   * `RegisterController#redirectHome` guards it.
   *
   * @returns {undefined} Always `undefined`, so callers can `return` it directly.
   */
  static #sessionExpired() {
    AuthSession.clear();

    if (typeof window !== 'undefined') {
      window.location.hash = LOGIN_HASH;
    }

    return undefined;
  }
}
