import { BadRequestError } from '../exceptions/http/BadRequestError.js';
import { ForbiddenError } from '../exceptions/http/ForbiddenError.js';
import { NotFoundError } from '../exceptions/http/NotFoundError.js';
import { UnauthorizedError } from '../exceptions/http/UnauthorizedError.js';

/**
 * Registers a route on an Express router by binding the handler's handle method.
 * @author darthjee
 */
class RouteRegister {
  #router;

  /**
   * @param {object} router - An Express Router instance.
   */
  constructor(router) {
    this.#router = router;
  }

  /**
   * Registers a route on the router.
   * Catches BadRequestError → 400, UnauthorizedError → 401, ForbiddenError → 403,
   * NotFoundError → 404, and any other error → 500. The handler may be sync or
   * return a Promise — either way its rejection/throw is caught.
   * @param {object} params - Options for registering a route.
   * @param {string} [params.method] - The HTTP method (lowercase), defaults to 'get'.
   * @param {string} params.route - The route path (e.g. '/health.json').
   * @param {object} params.handler - The handler whose handle method is called.
   * @returns {void}
   */
  register({ method = 'get', route, handler }) {
    this.#router[method](route, async (req, res) => {
      try {
        await handler.handle(req, res);
      } catch (e) {
        this.#handleError(e, res);
      }
    });
  }

  /**
   * Maps a caught exception to an HTTP error response.
   * @param {Error} e - The caught exception.
   * @param {object} res - The Express response object.
   * @returns {void}
   */
  #handleError(e, res) {
    let statusCode;
    let message;
    if (e instanceof BadRequestError) {
      statusCode = 400;
      message = e.message;
    } else if (e instanceof UnauthorizedError) {
      statusCode = 401;
      message = e.message;
    } else if (e instanceof ForbiddenError) {
      statusCode = 403;
      message = 'Forbidden';
    } else if (e instanceof NotFoundError) {
      statusCode = 404;
      message = e.message;
    } else {
      statusCode = 500;
      message = 'Internal Server Error';
    }
    res.status(statusCode).json({ error: message });
  }
}

export { RouteRegister };
