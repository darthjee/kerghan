# GitHub handle controller

Create `GithubHandleController`, a state-setter controller like `SessionsController`. Its constructor takes `setState` (or a small set of setters) and `client = AccountsClient`. The section's state is `{ handle, loading, loadError, fieldError, submitError, successMessage, saving }`.

- `load()`: sets `loading: true` and calls `client.getMyAccount()`. On success it sets `handle` to `githubHandle ?? ''`, with `loading: false`. On failure it sets `loadError: 'Could not load your GitHub handle.'` and the section stays disabled. A `401` is left to `ApiClient`'s usual flow.
- `save(rawValue)`:
  1. Trim the value. When it is empty, the payload is `null`.
  2. Otherwise, normalise for validation only: strip one leading `@`, then lowercase. Test the result against `^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$`. On failure, set `fieldError: 'Use letters, digits and single hyphens (max 39 characters).'` and send nothing.
  3. Send the **trimmed** value (not the normalised one, per the spec; the server normalises) through `client.updateGithubHandle`. Clear the field and submit errors and the success message first.
  4. On success, set `handle` to the response's `githubHandle ?? ''`, with `successMessage` set to `'GitHub handle updated.'`, or to `'GitHub handle removed.'` when the response's handle is `null`.
  5. On error, set `submitError` to `error.message`.

Put the normalise-and-validate logic in a small pure helper (e.g. `validateGithubHandle` in `utils/validation/fieldValidators.js`, or a sibling module), so it can be tested on its own.

Specs (controller layer, with a fixed setup like `integrationsControllerHarness`, `flushMicrotasks` and a fake client):
- load: success, a `null` handle (empty input), failure (the load-error text);
- save: the payload for a valid value, for `@DarthJee` and mixed case (they pass), and `null` for an empty or whitespace-only input;
- the invalid cases (`--`, a leading or trailing hyphen, 40 characters, `@@x`, symbols) set the inline error and make no call;
- success adopts the response's normalised value with the right message for each case;
- a server error sets `submitError` from `error.message`;
- no `currentPassword` is ever sent.

## Files to Change
- `frontend/assets/js/components/resources/accounts/pages/controllers/GithubHandleController.js` (new).
- `frontend/assets/js/utils/validation/fieldValidators.js` (or a new sibling module) — the handle validator.
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/GithubHandleControllerSpec.js` (new).
- The validator's spec next to the existing `fieldValidators` spec.
