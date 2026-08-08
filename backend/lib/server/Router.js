import express from 'express';
import { HandlerConfig } from './HandlerConfig.js';
import { HealthHandler } from './handlers/HealthHandler.js';
import { RouteRegister } from './RouteRegister.js';

const { Router: ExpressRouter } = express;

/**
 * Builds the Express router with all application routes.
 * @author darthjee
 */
class Router {
  /**
   * Creates and returns an Express Router with all routes registered.
   * @returns {object} An Express Router instance.
   */
  build() {
    const router = ExpressRouter();
    const register = new RouteRegister(router);

    router.use(express.json());

    const GET_ROUTES = {
      '/health.json': new HandlerConfig(HealthHandler),
    };

    Object.entries(GET_ROUTES).forEach(([route, handler]) => {
      register.register({ route, handler });
    });

    return router;
  }
}

export { Router };
