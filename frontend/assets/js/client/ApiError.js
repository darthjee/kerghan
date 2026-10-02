/**
 * Error raised when an API request fails, carrying the response's HTTP status and the
 * backend's standard error body fields (`error.message`, `error.code`, `error.details`), plus
 * the `Retry-After` header (`retryAfter`, in seconds) when the response carried one.
 */
export default class ApiError extends Error {
  /**
   * Create an API error.
   *
   * @param {number} status - HTTP status code of the failed response.
   * @param {string} message - Human-readable error message returned by the backend (or a
   *   generic fallback when the response carried none).
   * @param {string} [code] - Machine-readable error code (e.g. `USERNAME_TAKEN`,
   *   `VALIDATION_FAILED`); `undefined` when the response carried none.
   * @param {string[]} [details] - Full list of validation messages; only present on
   *   validation failures, `undefined` otherwise.
   * @param {number} [retryAfter] - Seconds to wait before retrying, read from the response's
   *   `Retry-After` header (e.g. on a `429`); `undefined` when absent or invalid.
   */
  constructor(status, message, code, details, retryAfter) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfter = retryAfter;
  }
}
