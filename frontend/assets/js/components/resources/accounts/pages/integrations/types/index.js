import OauthAppType from './oauthApp.js';
import PatType from './pat.js';

/**
 * Integration types the frontend implements a flow for, keyed by `type`. Later types (GitHub
 * App) plug in by adding an entry here.
 *
 * @type {Map<string, object>}
 */
const IMPLEMENTED = new Map([
  [PatType.type, PatType],
  [OauthAppType.type, OauthAppType],
]);

const GENERIC_REASONS = new Map([
  ['insufficient_permissions', 'This integration lacks the required permissions. Replace its credential.'],
]);

const NAMES = new Map([
  ['pat', 'Personal Access Token'],
  ['oauth_app', 'OAuth App'],
  ['github_app', 'GitHub App'],
]);

/**
 * Registry of integration types: human names for every known type, and the per-type
 * definitions (form fields, texts, credential builder) of the implemented ones.
 */
const IntegrationTypes = {
  /**
   * Look up an implemented type's definition.
   *
   * @param {string} type - The integration type (e.g. `pat`).
   * @returns {object|undefined} The type definition, or `undefined` when not implemented.
   */
  get(type) {
    return IMPLEMENTED.get(type);
  },

  /**
   * Human name of a type, for any known type (implemented or not).
   *
   * @param {string} type - The integration type.
   * @returns {string} The type's human name, or the raw type for an unknown one.
   */
  nameOf(type) {
    return NAMES.get(type) ?? type;
  },

  /**
   * Intersect the server's enabled types with the implemented ones, keeping the server's
   * (registry) order.
   *
   * @param {Array<{type: string}>} enabledTypes - Types returned by `POST /integrations/types.json`.
   * @returns {Array<object>} The definitions of the types that are both enabled and implemented.
   */
  available(enabledTypes) {
    return enabledTypes
      .map(({ type }) => IMPLEMENTED.get(type))
      .filter(Boolean);
  },

  /**
   * Look up the UI text of an integration's `invalid` status reason.
   *
   * @param {string} type - The integration type.
   * @param {string|null} reason - The integration's `statusReason`.
   * @returns {string|null} The reason's text, falling back to the raw code; `null` when there
   *   is no reason.
   */
  reasonText(type, reason) {
    if (!reason) {
      return null;
    }

    return IMPLEMENTED.get(type)?.reasonText(reason) ?? GENERIC_REASONS.get(reason) ?? reason;
  },
};

export default IntegrationTypes;
