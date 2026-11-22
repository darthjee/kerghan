/**
 * The sentence of each `sync_failed` reason that points at a credential problem, from the Link
 * and sync states table of the UI spec (without the "Fix it in Integrations" tail).
 *
 * @type {Map<string, string>}
 */
const CREDENTIAL_REASON_SENTENCES = new Map([
  ['no_credential', 'No GitHub credential can access this repository.'],
  ['credential_invalid', 'The GitHub credential for this repository is no longer valid.'],
  ['forbidden', 'The GitHub credential for this repository can\'t update issues.'],
]);

/**
 * The link that sends the user to fix the credential, shared by the error map and the link
 * panel.
 *
 * @type {{href: string, text: string}}
 */
export const FIX_LINK = { href: '#/account/integrations', text: 'Fix it in Integrations' };

/**
 * Panel messages of the `sync_failed` reasons that point at a credential, keyed by
 * `sync_failed/<reason>`; each builds `{text, link}` with the Fix link.
 *
 * @type {Map<string, Function>}
 */
export const FAILURE_MESSAGES = new Map(
  [...CREDENTIAL_REASON_SENTENCES].map(([reason, text]) => [
    `sync_failed/${reason}`,
    () => ({ text, link: { ...FIX_LINK } }),
  ]),
);

export default CREDENTIAL_REASON_SENTENCES;
