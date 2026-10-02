const REASON_TEXTS = new Map([
  ['bad_credentials', 'GitHub rejected this token. It may have been revoked or deleted. Replace it with a new token.'],
  ['insufficient_permissions', 'This classic token lacks the `repo` scope. Replace it with a token that has `repo`, or with a fine-grained token.'],
]);

/**
 * Personal Access Token (`pat`) integration type, as defined in
 * `docs/agents/specs/integrations/types/pat.md`: its picker texts, credential-paste form fields,
 * credential builder, `invalid` reason texts and UI guidance.
 */
const PatType = {
  type: 'pat',
  name: 'Personal Access Token',
  flow: 'paste',
  description: 'Paste a GitHub personal access token (classic or fine-grained).',
  credentialFields: [{ name: 'token', label: 'Token' }],
  links: [
    { href: 'https://github.com/settings/personal-access-tokens', label: 'Fine-grained tokens' },
    { href: 'https://github.com/settings/tokens', label: 'Classic tokens' },
  ],
  recommendation: 'Prefer a fine-grained token, granting Issues: read and Metadata: read on the '
    + 'repositories you want Kerghan to monitor.',
  warning: 'A classic token needs the repo scope, which also grants write access to every '
    + 'repository you can reach.',
  removeReminder: 'Kerghan only forgets the token. Revoke it on GitHub if you no longer need it.',

  /**
   * Build the `credential` request object from the form's credential field values.
   *
   * @param {{token: string}} values - The credential form values.
   * @returns {{token: string}} The `credential` object to send to the API.
   */
  buildCredential(values) {
    return { token: values.token ?? '' };
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
};

export default PatType;
