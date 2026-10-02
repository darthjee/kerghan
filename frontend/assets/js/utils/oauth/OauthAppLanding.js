const CALLBACK_PATH = '/integrations/oauth_app/callback';
const LANDING_TARGET = '/#/account/integrations';

let pending = null;

/**
 * Classify GitHub's redirect parameters into a landing result.
 *
 * @param {URLSearchParams} params - The landing URL's query parameters.
 * @returns {{kind: string, code: (string|undefined), state: (string|undefined)}} The result:
 *   `cancelled`, `failed`, or `callback` carrying the `code` and `state`.
 */
function classify(params) {
  const error = params.get('error');

  if (error === 'access_denied') {
    return { kind: 'cancelled' };
  }

  const code = params.get('code');
  const state = params.get('state');

  if (error || !code || !state) {
    return { kind: 'failed' };
  }

  return { kind: 'callback', code, state };
}

/**
 * Captures the OAuth App landing (`/integrations/oauth_app/callback?code=…&state=…`), as
 * described in `docs/agents/specs/integrations/types/oauth-app.md#landing`.
 *
 * @description Must run before the app renders (so before any request): it reads GitHub's
 * parameters, immediately rewrites the URL to `/#/account/integrations` with
 * `history.replaceState`, and keeps the result in module memory only — never in storage, the
 * console or the URL. The Integrations page takes it once.
 */
const OauthAppLanding = {
  /**
   * Capture the landing when the browser is on the callback path; a no-op elsewhere.
   *
   * @param {{pathname: string, search: string}} location - The browser's `window.location`.
   * @param {{replaceState: Function}} history - The browser's `window.history`.
   * @returns {boolean} `true` when the landing was captured.
   */
  capture(location, history) {
    if (location.pathname !== CALLBACK_PATH) {
      return false;
    }

    const params = new URLSearchParams(location.search);

    history.replaceState(null, '', LANDING_TARGET);
    pending = classify(params);

    return true;
  },

  /**
   * Take the pending landing result, once: later calls return `null` until the next capture,
   * so the `code` and `state` don't outlive the single callback request.
   *
   * @returns {{kind: string, code: (string|undefined), state: (string|undefined)}|null} The
   *   pending result, or `null` when there is none.
   */
  take() {
    const result = pending;

    pending = null;

    return result;
  },
};

export default OauthAppLanding;
