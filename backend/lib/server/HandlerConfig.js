/**
 * Holds the configuration for a route handler and lazily instantiates it on each request.
 * @author darthjee
 */
class HandlerConfig {
  #handlerExecutorClass;
  #parameters;

  /**
   * Creates a new HandlerConfig.
   * @param {Function} handlerExecutorClass - The request handler executor class to instantiate.
   * @param {Array<*>|*} [parameters=[]] - Extra parameters to pass after the request and response.
   */
  constructor(handlerExecutorClass, parameters = []) {
    this.#handlerExecutorClass = handlerExecutorClass;
    this.#parameters = Array.isArray(parameters) ? parameters : [parameters];
  }

  /**
   * Instantiates the handler executor class with the stored parameters and delegates the request to it.
   * @param {object} req - The Express request object.
   * @param {object} res - The Express response object.
   * @returns {*} Whatever the handler's handle() returns (a Promise for async handlers).
   */
  handle(req, res) {
    return new this.#handlerExecutorClass(req, res, ...this.#parameters).handle();
  }
}

export { HandlerConfig };
