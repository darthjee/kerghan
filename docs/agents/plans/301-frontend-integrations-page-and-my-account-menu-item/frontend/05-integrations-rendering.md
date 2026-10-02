# Integrations page rendering and PAT form
Add `helpers/IntegrationsHelper.jsx` (split into smaller helpers if it grows), rendering per `ui.md`:

- **States:** loading, empty (explains what integrations are for, plus an "Add integration" action), error (standard message plus retry).
- **List columns:**
  - Label.
  - Type, as a human name.
  - GitHub account, with a hint when two rows share the login.
  - Status badge. `invalid` shows its `statusReason` text from the type's reason texts; `undecryptable` shows its explanation.
  - Credential: `secretHint`, or "unavailable".
  - Expiry: the date or "no expiry", with an *expiring soon* flag within 7 days unless already `expired`.
  - Last tested: relative time and result, or "never".
  - Actions.
- **Actions:**
  - rename (inline or modal, implementer's choice);
  - replace credential, offered for every status and highlighted for `invalid`, `expired` and `undecryptable`;
  - remove, with a confirmation that names the label and includes the PAT reminder to revoke the token on GitHub;
  - test, disabled during the cooldown;
  - errors shown per action.
- **Type picker and PAT form** (from `types/pat.md`, *UI guidance*):
  - fields: *Label* (text) and *Token* (`type="password"`, `autocomplete="off"`);
  - links to GitHub's fine-grained and classic token settings;
  - the fine-grained recommendation and the classic `repo` scope warning.

  The same form serves replace credential, without the label field.

Specs: helper specs for every status (including `invalid` with reason and `undecryptable`), expiring-soon inside and outside the 7-day window, the shared-login hint, the empty/loading/error states, each action's controls and error display, the credential input attributes, and the **canary** test: render and submit a form with a canary token, then assert it never reaches `console` (spy), `localStorage`/`sessionStorage`, or `window.location`.

## Files to Change
- `frontend/assets/js/components/resources/accounts/pages/helpers/IntegrationsHelper.jsx` (plus any sub-helpers): rendering.
- Matching specs under `frontend/specs/assets/js/components/resources/accounts/pages/helpers/`.
