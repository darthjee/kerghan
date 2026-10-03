/**
 * Pieces shared by the redirect-flow modules (OAuth App and GitHub App): list upsert, the start
 * error reporter and the unexpected-URL text.
 */
const RedirectShared = {
  /**
   * Text shown instead of navigating when a start route answered an unexpected URL.
   *
   * @type {string}
   */
  UNEXPECTED_URL_MESSAGE: 'Kerghan received an unexpected authorization address and did not follow it.',

  /**
   * Insert a created integration at the top of the list, or replace a reconnected one in place.
   *
   * @param {Array<object>} current - The current integrations.
   * @param {{id: string}} integration - The created or reconnected integration.
   * @returns {Array<object>} The updated list.
   */
  upsert(current, integration) {
    if (!current.some(({ id }) => id === integration.id)) {
      return [integration, ...current];
    }

    return current.map((existing) => (existing.id === integration.id ? integration : existing));
  },

  /**
   * Build the error reporter of a redirect start: the row's error for a reconnect, the add
   * form's error for a create.
   *
   * @param {{patchRow: Function, patchAddForm: Function}} controller - The page's controller.
   * @param {{integrationId: (string|undefined)}} body - The start request body.
   * @returns {Function} Stores an error message (or `null` to clear it).
   */
  reporterFor(controller, { integrationId }) {
    if (integrationId) {
      return (error) => controller.patchRow(integrationId, { error });
    }

    return (error) => controller.patchAddForm({ error });
  },

  /**
   * Show a captured landing's notice when its kind has one (cancelled, failed, …).
   *
   * @param {{setNotice: Function}} controller - The page's controller.
   * @param {Map<string, {variant: string, text: string}>} notices - Notices keyed by landing kind.
   * @param {{kind: string}} landing - The captured landing.
   * @returns {boolean} `true` when a notice was shown (so there is nothing to post).
   */
  showLandingNotice(controller, notices, landing) {
    const notice = notices.get(landing.kind);

    if (!notice) {
      return false;
    }

    controller.setNotice(notice);

    return true;
  },
};

export default RedirectShared;
