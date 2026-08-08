import express from 'express';
import session from 'express-session';
import { HandlerConfig } from './HandlerConfig.js';
import { Authenticator } from '../accounts/Authenticator.js';
import { HealthHandler } from './handlers/HealthHandler.js';
import { LoginHandler } from './handlers/LoginHandler.js';
import { RouteRegister } from './RouteRegister.js';

const { Router: ExpressRouter } = express;

/**
 * Builds the Express router with all application routes.
 * @author darthjee
 */
class Router {
  #models;
  #secretKey;
  #isProduction;

  /**
   * @param {object} params - Router dependencies.
   * @param {object} params.models - The injected Sequelize models (e.g. { User }).
   * @param {string} params.secretKey - The session cookie signing secret.
   * @param {boolean} params.isProduction - Whether to mark the session cookie as secure-only.
   */
  constructor({ models, secretKey, isProduction }) {
    this.#models = models;
    this.#secretKey = secretKey;
    this.#isProduction = isProduction;
  }

  /**
   * Creates and returns an Express Router with all routes registered.
   * @returns {object} An Express Router instance.
   */
  build() {
    const router = ExpressRouter();
    const register = new RouteRegister(router);
    const authenticator = new Authenticator(this.#models.User);

    router.use(express.json());
    router.use(this.#buildSession());

    const GET_ROUTES = {
      '/health.json': new HandlerConfig(HealthHandler),
    };
    const POST_ROUTES = {
      '/login.json': new HandlerConfig(LoginHandler, authenticator),
    };

    Object.entries(GET_ROUTES).forEach(([route, handler]) => {
      register.register({ method: 'get', route, handler });
    });
    Object.entries(POST_ROUTES).forEach(([route, handler]) => {
      register.register({ method: 'post', route, handler });
    });

    return router;
  }

  /**
   * Builds the session middleware, signed with the injected secret key.
   * @returns {Function} The express-session middleware.
   */
  #buildSession() {
    return session({
      secret: this.#secretKey,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.#isProduction,
      },
    });
  }
}

export { Router };
