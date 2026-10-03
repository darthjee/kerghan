const REASON_TEXTS = new Map([
  ['uninstalled', 'Kerghan\'s GitHub App is no longer installed on this account. Reinstall it and reconnect.'],
  ['suspended', 'This installation is suspended on GitHub. Unsuspend it in the account\'s GitHub '
    + 'settings, then test again.'],
  ['insufficient_permissions', 'This installation hasn\'t granted Issues and Metadata read access. '
    + 'Accept the app\'s requested permissions on GitHub, then test again.'],
]);

const REPOSITORY_SELECTIONS = new Map([
  ['all', 'all repositories'],
  ['selected', 'selected repositories'],
]);

const ERROR_TEXTS = new Map([
  ['INTEGRATION_REDIRECT_STATE_INVALID', 'This GitHub link expired or was already used. Start again.'],
]);

/**
 * GitHub App installation (`github_app`) integration type, as defined in
 * `docs/agents/modules/integrations/github-app.md`: a redirect-flow type with two modes
 * (install and connect existing), no credential input, its picker texts, warnings, `invalid`
 * reason texts, per-type error texts and UI guidance.
 */
const GithubAppType = {
  type: 'github_app',
  name: 'GitHub App',
  flow: 'redirect',
  modes: ['install', 'connect'],
  description: 'Connect a GitHub account or organization by installing Kerghan\'s GitHub App. '
    + 'Read-only access to issues; no token is stored.',
  warnings: [
    'The app only asks for read access to issues and metadata.',
    'Organization members without admin rights can\'t install it, but can request it or connect '
      + 'an existing installation.',
  ],
  connectHint: 'Use this if the app is already installed on your account or organization.',
  requiresServerConfig: true,

  /**
   * Row details shown under the account login: the account type and the repository selection.
   *
   * @param {{metadata: (object|undefined|null)}} integration - The integration.
   * @returns {Array<string>} The details, skipping any the metadata lacks.
   */
  details(integration) {
    const metadata = integration?.metadata ?? {};

    return [metadata.accountType, REPOSITORY_SELECTIONS.get(metadata.repositorySelection)].filter(Boolean);
  },

  /**
   * Build the Remove confirmation reminder, naming the installation's account.
   *
   * @param {{githubLogin: (string|null)}} integration - The integration being removed.
   * @returns {string} The reminder text.
   */
  removeReminder(integration) {
    const account = integration?.githubLogin ? integration.githubLogin : 'its GitHub account';

    return `Kerghan's GitHub App stays installed on ${account}, and other connections may still `
      + 'use it. Uninstall it on GitHub if you no longer want it.';
  },

  /**
   * Look up the UI text of an `invalid` status reason code.
   *
   * @param {string} reason - The integration's `statusReason`.
   * @returns {string|undefined} The reason's text, or `undefined` for an unknown code.
   */
  reasonText(reason) {
    return REASON_TEXTS.get(reason);
  },

  /**
   * Look up this type's own text for an API error code, overriding the generic one.
   *
   * @param {string} code - The API error code.
   * @returns {string|undefined} The type's text, or `undefined` to use the generic one.
   */
  errorText(code) {
    return ERROR_TEXTS.get(code);
  },
};

export default GithubAppType;
