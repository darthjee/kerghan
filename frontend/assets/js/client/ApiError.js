/**
 * Error raised when an API request fails, carrying the response's HTTP status and the
 * backend's error message.
 */
export default class ApiError extends Error {
  /**
   * Create an API error.
   *
   * @param {number} status - HTTP status code of the failed response.
   * @param {string} message - Error message returned by the backend.
   */
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
