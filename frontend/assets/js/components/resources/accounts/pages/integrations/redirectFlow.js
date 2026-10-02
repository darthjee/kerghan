import IntegrationErrors from './errorMessages.js';

const GITHUB_AUTHORIZE_PREFIX = 'https://github.com/login/oauth/authorize?';

/**
 * Build the error reporter of a redirect start: the row's error for a reconnect, the add
 * form's error for a create.
 *
 * @param {{patchRow: Function, patchAddForm: Function}} controller - The page's controller.
 * @param {{integrationId: (string|undefined)}} body - The start request body.
 * @returns {Function} Stores an error message (or `null` to clear it).
 */
function reporterFor(controller, { integrationId }) {
  if (integrationId) {
    return (error) => controller.patchRow(integrationId, { error });
  }

  return (error) => controller.patchAddForm({ error });
}

/**
 * The OAuth App redirect flow's start: asks the backend for the authorize URL and sends the
 * browser there, only when it is GitHub's authorize page.
 */
const RedirectFlow = {
  /**
   * Text shown instead of navigating when the start route answered an unexpected URL.
   *
   * @type {string}
   */
  UNEXPECTED_URL_MESSAGE: 'Kerghan received an unexpected authorization address and did not follow it.',

  /**
   * Whether a URL is GitHub's OAuth authorize page, the only place a redirect flow may go.
   *
   * @param {*} url - The `authorizeUrl` from the start response.
   * @returns {boolean} `true` when it starts with `https://github.com/login/oauth/authorize?`.
   */
  isGithubAuthorizeUrl(url) {
    return typeof url === 'string' && url.startsWith(GITHUB_AUTHORIZE_PREFIX);
  },

  /**
   * Start the redirect flow and navigate to GitHub. Errors (API errors mapped to friendly
   * text, or an unexpected URL) go to the add form (create) or to the row (reconnect); an
   * expired session (`undefined` result) changes nothing.
   *
   * @param {{client: object, navigate: Function, patchRow: Function, patchAddForm: Function}}
   *   controller - The page's controller.
   * @param {{label: string}|{integrationId: string}} body - The start request body.
   * @returns {Promise<void>} Resolves once the request finishes.
   */
  async start(controller, body) {
    const report = reporterFor(controller, body);

    report(null);

    try {
      const result = await controller.client.startOauthApp(body);

      if (!result) {
        return;
      }

      if (!RedirectFlow.isGithubAuthorizeUrl(result.authorizeUrl)) {
        report(RedirectFlow.UNEXPECTED_URL_MESSAGE);
        return;
      }

      controller.navigate(result.authorizeUrl);
    } catch (error) {
      report(IntegrationErrors.messageFor(error));
    }
  },
};

export default RedirectFlow;
