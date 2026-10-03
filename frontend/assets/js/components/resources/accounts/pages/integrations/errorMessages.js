import IntegrationTypes from './types/index.js';

const FALLBACK = 'Request failed';

/**
 * Friendly text for the integrations API's known error codes; each entry receives the
 * `ApiError` so it can use its details (e.g. `retryAfter`).
 *
 * @type {Map<string, Function>}
 */
const MESSAGES = new Map([
  ['INTEGRATION_LABEL_TAKEN', () => 'You already have an integration with this label. Choose another one.'],
  ['INTEGRATIONS_LIMIT_REACHED', () => 'You reached the maximum number of integrations. Remove one before adding another.'],
  ['INTEGRATION_CREDENTIAL_LOCKED', () => 'Too many failed attempts. Wait a while before trying again.'],
  ['INTEGRATION_CREDENTIAL_INVALID', () => 'GitHub rejected this credential. Check it and try again.'],
  ['INTEGRATION_INSUFFICIENT_PERMISSIONS', () => 'This credential lacks the required permissions.'],
  ['INTEGRATION_TEST_COOLDOWN', (error) => cooldownMessage(error.retryAfter)],
  ['INTEGRATION_REDIRECT_STATE_INVALID', () => 'This GitHub authorization link expired or was already used. Start again.'],
  ['INTEGRATION_INSTALLATION_NOT_ACCESSIBLE', () => 'Your GitHub account can\'t access that installation '
    + 'of Kerghan\'s GitHub App. Install it, or ask the account\'s owner to.'],
  ['INTEGRATION_INSTALLATION_SUSPENDED', () => 'This installation is suspended on GitHub. Unsuspend it in '
    + 'the account\'s GitHub settings, then try again.'],
  ['GITHUB_UNAVAILABLE', () => 'GitHub is unavailable right now. Try again later.'],
  ['GITHUB_RATE_LIMITED', () => 'GitHub rate limit reached. Try again later.'],
  ['VALIDATION_FAILED', (error) => `Some fields are invalid: ${error.message}`],
]);

/**
 * Build the test-cooldown message.
 *
 * @param {number|undefined} retryAfter - Seconds to wait, from `Retry-After`.
 * @returns {string} The message.
 */
function cooldownMessage(retryAfter) {
  if (retryAfter === undefined) {
    return 'This integration was tested recently. Try again shortly.';
  }

  return `This integration was tested recently. Try again in ${retryAfter} seconds.`;
}

/**
 * Maps integrations API errors to the text shown to the user.
 */
const IntegrationErrors = {
  /**
   * Text to show for a failed integrations request.
   *
   * @param {{code: (string|undefined), message: (string|undefined)}} error - The thrown error
   *   (usually an `ApiError`).
   * @param {string} [type] - The integration type the request was about; its own text for the
   *   code (see a type's `errorText`) wins over the generic one.
   * @returns {string} Friendly text for a known code, else the error's message, else a
   *   generic fallback.
   */
  messageFor(error, type) {
    const override = IntegrationTypes.get(type)?.errorText?.(error?.code);

    if (override) {
      return override;
    }

    const build = MESSAGES.get(error?.code);

    return build ? build(error) : (error?.message || FALLBACK);
  },
};

export default IntegrationErrors;
