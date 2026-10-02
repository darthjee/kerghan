import OauthAppLanding from '../../../../../utils/oauth/OauthAppLanding.js';
import IntegrationErrors from './errorMessages.js';

const GITHUB_AUTHORIZE_PREFIX = 'https://github.com/login/oauth/authorize?';

const LANDING_NOTICES = new Map([
  ['cancelled', { variant: 'warning', text: 'You cancelled the GitHub authorization.' }],
  ['failed', { variant: 'danger', text: 'GitHub didn\'t complete the authorization. Try again.' }],
]);

/**
 * Insert a created integration at the top of the list, or replace a reconnected one in place.
 *
 * @param {Array<object>} current - The current integrations.
 * @param {{id: string}} integration - The created or reconnected integration.
 * @returns {Array<object>} The updated list.
 */
function upsert(current, integration) {
  if (!current.some(({ id }) => id === integration.id)) {
    return [integration, ...current];
  }

  return current.map((existing) => (existing.id === integration.id ? integration : existing));
}

/**
 * Send the landing's `code` and `state` to the callback route, once, and show the outcome.
 *
 * @param {{client: object, setIntegrations: Function, setNotice: Function}} controller - The
 *   page's controller.
 * @param {{code: string, state: string}} landing - The captured landing values.
 * @returns {Promise<void>} Resolves once the request finishes.
 */
async function complete(controller, { code, state }) {
  try {
    const integration = await controller.client.completeOauthApp({ code, state });

    if (!integration) {
      return;
    }

    controller.setIntegrations((current) => upsert(current, integration));
    controller.setNotice({ variant: 'success', text: `Connected to GitHub as ${integration.githubLogin}` });
  } catch (error) {
    controller.setNotice({ variant: 'danger', text: IntegrationErrors.messageFor(error) });
  }
}

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
 * The OAuth App redirect flow: its start (asks the backend for the authorize URL and sends the
 * browser there, only when it is GitHub's authorize page) and its landing (sends the captured
 * `code` and `state` to the callback route).
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

  /**
   * Consume the pending OAuth App landing, if any: a cancelled or failed authorization only
   * shows its notice; a callback posts `{ code, state }` (held in this call only) and shows
   * "Connected to GitHub as <login>" or the mapped error.
   *
   * @param {{client: object, setIntegrations: Function, setNotice: Function}} controller - The
   *   page's controller.
   * @returns {Promise<void>} Resolves once the landing is handled.
   */
  async completeLanding(controller) {
    const landing = OauthAppLanding.take();

    if (!landing) {
      return;
    }

    const notice = LANDING_NOTICES.get(landing.kind);

    if (notice) {
      controller.setNotice(notice);
      return;
    }

    await complete(controller, landing);
  },
};

export default RedirectFlow;
