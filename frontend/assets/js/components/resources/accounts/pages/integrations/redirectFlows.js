import GithubAppFlow from './githubAppFlow.js';
import RedirectFlow from './redirectFlow.js';

/**
 * Redirect-flow modules keyed by integration type; each exposes `start(controller, body)` and
 * `completeLanding(controller)`.
 *
 * @type {Map<string, object>}
 */
const FLOWS = new Map([
  ['oauth_app', RedirectFlow],
  ['github_app', GithubAppFlow],
]);

/**
 * Dispatches the Integrations page's redirect-flow operations to the type owning them.
 */
const RedirectFlows = {
  /**
   * Build a start request body, adding the redirect `mode` only when there is one.
   *
   * @param {object} body - `{ label }` or `{ integrationId }`.
   * @param {string|undefined} mode - The redirect mode (`install` or `connect`), if any.
   * @returns {object} The body, with `mode` when given.
   */
  startBody(body, mode) {
    return mode ? { ...body, mode } : body;
  },

  /**
   * Start a type's redirect flow (see each flow's `start`).
   *
   * @param {object} controller - The page's controller.
   * @param {string} type - The redirect-flow integration type.
   * @param {object} body - The start request body.
   * @returns {Promise<void>} Resolves once the request finishes.
   */
  async start(controller, type, body) {
    return FLOWS.get(type).start(controller, body);
  },

  /**
   * Handle whichever redirect-flow landing is pending, one type after the other.
   *
   * @param {object} controller - The page's controller.
   * @returns {Promise<void>} Resolves once every landing is handled.
   */
  async completeLandings(controller) {
    for (const flow of FLOWS.values()) {
      await flow.completeLanding(controller);
    }
  },
};

export default RedirectFlows;
