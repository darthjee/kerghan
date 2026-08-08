import { RequestHandler } from '../RequestHandler.js';

/**
 * Executes request-handling behaviour for the health-check route, used to
 * prove the backend skeleton boots and is reachable through the proxy.
 * @author darthjee
 */
class HealthHandler extends RequestHandler {
  #response;

  /**
   * @param {object} _request - The Express request object.
   * @param {object} response - The Express response object.
   */
  constructor(_request, response) {
    super();
    this.#response = response;
  }

  /**
   * Responds with a fixed { status: 'ok' } payload.
   * @returns {void}
   */
  handle() {
    this.#response.status(200).json({ status: 'ok' });
  }
}

export { HealthHandler };
