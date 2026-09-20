# Add the shared example group

Create `frontend/specs/support/accountEditFormControllerExamples.js` exporting a function (e.g. `itBehavesLikeAnAccountEditFormController(options)`) that, when called inside a `describe`, registers the common cases. It must be named so it does not match `*[sS]pec.js`.

Suggested `options` (adjust names if a cleaner shape emerges, but keep the parameterisation points):

- `ControllerClass` and `clientMethod` (`'updateAccount'` | `'editUser'`), used to build the `client` spy object and the controller;
- `blankFields` — the base blank form (`username`, `email`, `newPassword`, `newPasswordConfirmation`); MyAccount passes its own with `currentPassword: 'secret'` added;
- `submit(controller, fields)` — adapter around `handleSubmit`, so Admin can call `handleSubmit(1, fields)`;
- `wrapResponse(account)` — identity for MyAccount, `(account) => ({ user: account })` for Admin;
- `expectedClientArgs(payload)` — the args the client method must have received: `[{ currentPassword: 'secret', ...payload }]` vs `[1, payload]`.

The module owns the shared `let setFields, setFieldErrors, setSubmitError, setSuccess, client` and the `beforeEach` that creates the spies (this removes the 11-line setup clone). Because each spec file still needs those spies (and a `buildController`) for its own controller-specific cases, have the module also return (or accept) a small context object whose properties are filled in by that `beforeEach`, so both the shared cases and the per-spec cases use the same spies.

Register these cases (ported from the existing specs, made generic through the options above):

- `#validate`: blank form returns `{}`; flags a malformed email; accepts a blank email; accepts a well-formed email; flags a new password shorter than 8 characters; flags a new-password/confirmation mismatch; accepts a matching, long-enough password and confirmation.
- `#handleSubmit`: invalid form sets field errors and skips the API call (use the malformed-email variant, which applies to both); nothing filled in sets a submit error and skips the API call; submits only the username / only the email / only the new password when just that field changed; submits every changed field together; on success reflects the response's username/email, clears `newPassword`/`newPasswordConfirmation` (assert with `jasmine.objectContaining` so the MyAccount-only `currentPassword: ''` is left to that spec) and flags success; stores the submit error on duplicate username, duplicate email, and **password too short** (the last one is the superset case only Admin has today); does nothing further when the client resolves `undefined` (expired session).

## Files to Change
- `frontend/specs/support/accountEditFormControllerExamples.js` — new shared example group; each case ported verbatim from the existing specs, parameterised only through the options above.
