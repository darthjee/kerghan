const INTEGRATIONS_LINK = { href: '#/account/integrations', text: 'Integrations' };

/**
 * Describe a `429` Add error.
 *
 * @param {{retryAfterSeconds: (number|undefined)}} error - The error.
 * @returns {{message: string}} The inline error.
 */
function rateLimited(error) {
  const seconds = error.retryAfterSeconds;

  return {
    message: seconds === undefined
      ? 'Too many repositories added — try again shortly.'
      : `Too many repositories added — try again in ${seconds} s.`,
  };
}

/**
 * Inline Add errors by HTTP status; a function receives the error.
 *
 * @type {Map<number, Function>}
 */
const BY_STATUS = new Map([
  [404, () => ({ message: 'Repository not found on GitHub.' })],
  [502, () => ({ message: 'GitHub is unavailable or rate limited — try again later.' })],
  [503, () => ({ message: 'GitHub is unavailable or rate limited — try again later.' })],
  [429, rateLimited],
]);

/**
 * Maps the Add route's errors to the inline error shown on the row.
 */
const AddErrorMessages = {
  /**
   * Describe a failed Add.
   *
   * @param {{status: number, code: (string|undefined), message: string}} error - The thrown
   *   error (usually an `ApiError`).
   * @returns {{message: string, link: ({href: string, text: string}|undefined)}} The inline
   *   error, with a link when the user can fix it elsewhere.
   */
  describe(error) {
    if (error?.code === 'REPOSITORY_SOURCE_UNUSABLE') {
      return {
        message: 'Fix the integration that sees this repository in',
        link: INTEGRATIONS_LINK,
      };
    }

    const build = BY_STATUS.get(error?.status);

    return build ? build(error) : { message: error?.message || 'Request failed' };
  },
};

export default AddErrorMessages;
