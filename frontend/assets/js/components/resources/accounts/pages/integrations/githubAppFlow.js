import GithubAppLanding from '../../../../../utils/oauth/GithubAppLanding.js';
import IntegrationErrors from './errorMessages.js';
import RedirectShared from './redirectShared.js';

const TYPE = 'github_app';
const INSTALL_URL = /^https:\/\/github\.com\/apps\/[a-z0-9-]+\/installations\/new\?/;
const AUTHORIZE_PREFIX = 'https://github.com/login/oauth/authorize?';

const LANDING_NOTICES = new Map([
  ['cancelled', { variant: 'warning', text: 'You cancelled the GitHub authorization.' }],
  ['requested', {
    variant: 'info',
    text: 'Waiting for an organization owner to approve the installation. Once they do, use '
      + '"Connect existing installation".',
  }],
  ['failed', { variant: 'danger', text: 'GitHub didn\'t complete the installation. Try again.' }],
]);

/**
 * Show a callback or select request's error as a page notice.
 *
 * @param {{setNotice: Function}} controller - The page's controller.
 * @param {Error} error - The thrown error.
 * @returns {void} Nothing.
 */
function showError(controller, error) {
  controller.setNotice({ variant: 'danger', text: IntegrationErrors.messageFor(error, TYPE) });
}

/**
 * Show a callback or select result: the installation selection, or the created/reconnected
 * row with its success notice. An expired session (`undefined`) changes nothing.
 *
 * @param {{setIntegrations: Function, setNotice: Function, setSelection: Function}} controller
 *   - The page's controller.
 * @param {object|undefined} result - The integration, `{ selection }`, or `undefined`.
 * @returns {void} Nothing.
 */
function showResult(controller, result) {
  if (!result) {
    return;
  }

  if (result.selection) {
    controller.setSelection(result.selection);
    return;
  }

  controller.setIntegrations((current) => RedirectShared.upsert(current, result));
  controller.setNotice({
    variant: 'success', text: `Connected to the GitHub App installation on ${result.githubLogin}`,
  });
}

/**
 * The GitHub App flow (`docs/agents/modules/integrations/github-app.md`): its start (asks
 * the backend for the install or authorize URL and sends the browser there, only when it is one
 * of GitHub's two expected shapes), its landing (posts the captured values to the callback
 * route) and the installation selection (posts the chosen installation to the select route).
 *
 * @description The `code` and the landing and selection `state` values are held only by the
 * request using them: the selection lives in page state until select runs, and is cleared then
 * whatever the outcome. None of them is logged, stored or put in the URL.
 */
const GithubAppFlow = {
  /**
   * Whether a URL is one of the two GitHub pages the GitHub App flow may go to.
   *
   * @param {*} url - The `redirectUrl` from the start response.
   * @returns {boolean} `true` for the app's installation page or GitHub's authorize page (each
   *   with a query string).
   */
  isGithubAppUrl(url) {
    return typeof url === 'string' && (INSTALL_URL.test(url) || url.startsWith(AUTHORIZE_PREFIX));
  },

  /**
   * Start the flow and navigate to GitHub. Errors (API errors mapped to friendly text, or an
   * unexpected URL) go to the add form (create) or to the row (reconnect); an expired session
   * (`undefined` result) changes nothing.
   *
   * @param {{client: object, navigate: Function, patchRow: Function, patchAddForm: Function}}
   *   controller - The page's controller.
   * @param {{label?: string, integrationId?: string, mode: string}} body - `{ label }` to
   *   create or `{ integrationId }` to reconnect, plus the `mode` (`install` or `connect`).
   * @returns {Promise<void>} Resolves once the request finishes.
   */
  async start(controller, body) {
    const report = RedirectShared.reporterFor(controller, body);

    report(null);

    try {
      const result = await controller.client.startGithubApp(body);

      if (!result) {
        return;
      }

      if (!GithubAppFlow.isGithubAppUrl(result.redirectUrl)) {
        report(RedirectShared.UNEXPECTED_URL_MESSAGE);
        return;
      }

      controller.navigate(result.redirectUrl);
    } catch (error) {
      report(IntegrationErrors.messageFor(error, TYPE));
    }
  },

  /**
   * Consume the pending GitHub App landing, if any: a cancelled, requested or failed landing
   * only shows its notice; a callback posts its values (held in this call only) and shows the
   * created/reconnected row, the installation selection, or the mapped error.
   *
   * @param {object} controller - The page's controller.
   * @returns {Promise<void>} Resolves once the landing is handled.
   */
  async completeLanding(controller) {
    const landing = GithubAppLanding.take();

    if (!landing || RedirectShared.showLandingNotice(controller, LANDING_NOTICES, landing)) {
      return;
    }

    const { code, state, installationId, setupAction } = landing;

    try {
      showResult(controller, await controller.client.completeGithubApp({
        code, state, installationId, setupAction,
      }));
    } catch (error) {
      showError(controller, error);
    }
  },

  /**
   * Pick one installation of the pending selection. The selection is cleared from page state
   * before the request, whatever its outcome.
   *
   * @param {object} controller - The page's controller.
   * @param {{state: string}} selection - The pending selection.
   * @param {number} installationId - The chosen installation's id.
   * @returns {Promise<void>} Resolves once the request finishes.
   */
  async select(controller, { state }, installationId) {
    controller.setSelection(null);

    try {
      showResult(controller, await controller.client.selectGithubAppInstallation({
        state, installationId,
      }));
    } catch (error) {
      showError(controller, error);
    }
  },
};

export default GithubAppFlow;
