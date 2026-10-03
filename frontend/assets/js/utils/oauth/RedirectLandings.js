import GithubAppLanding from './GithubAppLanding.js';
import OauthAppLanding from './OauthAppLanding.js';

/**
 * Landing captures of the redirect-flow types, keyed by their callback path.
 *
 * @type {Map<string, {capture: Function}>}
 */
const LANDINGS = new Map([
  [OauthAppLanding.path, OauthAppLanding],
  [GithubAppLanding.path, GithubAppLanding],
]);

/**
 * Dispatches the boot-time landing capture to the redirect-flow type owning the current path.
 */
const RedirectLandings = {
  /**
   * Capture the landing of whichever redirect-flow type owns `location.pathname`; a no-op on
   * any other path.
   *
   * @param {{pathname: string, search: string}} location - The browser's `window.location`.
   * @param {{replaceState: Function}} history - The browser's `window.history`.
   * @returns {boolean} `true` when a landing was captured.
   */
  capture(location, history) {
    return LANDINGS.get(location.pathname)?.capture(location, history) ?? false;
  },
};

export default RedirectLandings;
