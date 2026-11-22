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

export default CREDENTIAL_REASON_SENTENCES;
