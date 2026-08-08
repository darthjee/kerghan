import express from 'express';
import { Router } from './Router.js';

/**
 * Express web server for the Kerghan backend.
 * @author darthjee
 */
class WebServer {
  #port;
  #app;
  #httpServer;
  #startPromise;

  /**
   * @param {object} params - Options for initializing the WebServer.
   * @param {number} params.port - The port to listen on.
   */
  constructor({ port }) {
    this.#port = port;
    this.#app = express();
    this.#app.use(new Router().build());
  }

  /**
   * Starts the Express server on the configured port.
   * Returns a Promise that resolves when the HTTP server fires its 'close' event,
   * or rejects if the server fails to start.
   * @returns {Promise<void>} A Promise that resolves when the server closes.
   */
  start() {
    this.#startPromise = new Promise((resolve, reject) => {
      this.#httpServer = this.#app.listen(this.#port, () => {
        console.warn(`Kerghan backend listening on port ${this.#port}`);
      });
      this.#httpServer.on('close', resolve);
      this.#httpServer.on('error', reject);
    });
    return this.#startPromise;
  }

  /**
   * Closes the HTTP server. Stops accepting new connections so that the
   * start() promise can resolve.
   * @returns {Promise<void>|undefined} The promise from start(), or undefined if not started.
   */
  shutdown() {
    this.#httpServer?.close();
    return this.#startPromise;
  }
}

export { WebServer };
