const REASON_TEXTS = new Map([
  ['revoked', 'GitHub no longer accepts this authorization. It may have been revoked on GitHub, '
    + 'unused for a year, or replaced by newer authorizations. Reconnect to fix it.'],
  ['insufficient_permissions', 'This authorization lacks the `repo` scope. Reconnect with GitHub to grant it.'],
]);

/**
 * GitHub OAuth App (`oauth_app`) integration type, as defined in
 * `docs/agents/modules/integrations/oauth-app.md`: a redirect-flow type with no credential
 * input, its picker texts, warnings, `invalid` reason texts and UI guidance.
 */
const OauthAppType = {
  type: 'oauth_app',
  name: 'OAuth App',
  flow: 'redirect',
  description: 'Connect a GitHub account by authorizing Kerghan\'s OAuth App.',
  warnings: [
    'The repo scope also grants write access to every repository you can reach.',
    'Organizations may need to approve the app before their private repositories are visible.',
    'GitHub keeps at most 10 authorizations of the app per account, so connecting the same '
      + 'account more than 10 times revokes the oldest one.',
  ],
  removeReminder: 'Kerghan will also try to revoke this authorization on GitHub. Other '
    + 'connections of the same GitHub account keep working.',

  /**
   * Look up the UI text of an `invalid` status reason code.
   *
   * @param {string} reason - The integration's `statusReason`.
   * @returns {string|undefined} The reason's text, or `undefined` for an unknown code.
   */
  reasonText(reason) {
    return REASON_TEXTS.get(reason);
  },
};

export default OauthAppType;
