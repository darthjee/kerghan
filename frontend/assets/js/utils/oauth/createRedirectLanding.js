const LANDING_TARGET = '/#/account/integrations';

/**
 * Build the landing capture of one redirect-flow type: it recognises the type's callback path,
 * cleans the URL and keeps the classified result in memory until the Integrations page takes it.
 *
 * @description The returned `capture` must run before the app renders (so before any request):
 * it reads GitHub's parameters, immediately rewrites the URL to `/#/account/integrations` with
 * `history.replaceState`, and only then classifies them. The result lives in the closure only —
 * never in storage, the console or the URL — and `take` hands it out once.
 * @param {string} path - The type's landing path (e.g. `/integrations/oauth_app/callback`).
 * @param {Function} classify - Turns the landing's `URLSearchParams` into a `{ kind, … }` result.
 * @returns {{path: string, capture: Function, take: Function}} The landing capture.
 */
export default function createRedirectLanding(path, classify) {
  let pending = null;

  return {
    path,

    /**
     * Capture the landing when the browser is on the callback path; a no-op elsewhere.
     *
     * @param {{pathname: string, search: string}} location - The browser's `window.location`.
     * @param {{replaceState: Function}} history - The browser's `window.history`.
     * @returns {boolean} `true` when the landing was captured.
     */
    capture(location, history) {
      if (location.pathname !== path) {
        return false;
      }

      const params = new URLSearchParams(location.search);

      history.replaceState(null, '', LANDING_TARGET);
      pending = classify(params);

      return true;
    },

    /**
     * Take the pending landing result, once: later calls return `null` until the next capture,
     * so the values don't outlive the single request that uses them.
     *
     * @returns {object|null} The pending result, or `null` when there is none.
     */
    take() {
      const result = pending;

      pending = null;

      return result;
    },
  };
}
