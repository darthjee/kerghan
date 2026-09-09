# Recover / resetPassword handlers in LoginModalController

Add the two new modes' submit handlers to `LoginModalController`. Neither reaches the shared
`#handleSuccess` (which closes the modal + redirects) — both instead flip `resultPanel` so the
modal stays open on a panel.

## What to do

### `components/common/loginModal/controllers/LoginModalController.js`

- Constructor: add `setResultPanel` before `client`
  (`constructor(setMode, setFields, setFieldErrors, setSubmitError, setResultPanel, client = AccountsClient)`),
  store it as `this.setResultPanel`. Update the constructor JSDoc.
- `MODES`: add `recover: 'recover'` and `resetPassword: 'resetPassword'`.
- Add a shared validator instance next to `registerValidator`, with the same explanatory
  comment:
  `import ResetPasswordController from '../../../resources/accounts/pages/controllers/ResetPasswordController.js';`
  then `const resetPasswordValidator = new ResetPasswordController();` (no-arg after the
  controller is slimmed in step 04 — sequence step 04 before this if implementing serially, or
  keep the current 3-noop args until then).
- `switchMode`: also `this.setResultPanel(null)` so switching tabs drops any shown panel.
  Update its JSDoc (`'password'`, `'register'`, `'recover'`, `'resetPassword'`).
- `handleSubmit(mode, fields, resetToken)`: replace the two-branch `if` with a dispatch map
  keyed by mode so it stays readable / under the complexity limit with four modes, e.g.:

  ```js
  handleSubmit(mode, fields, resetToken) {
    const handlers = {
      [MODES.register]: () => this.#submitRegister(fields),
      [MODES.recover]: () => this.#submitRecover(fields),
      [MODES.resetPassword]: () => this.#submitResetPassword(fields, resetToken),
    };

    return (handlers[mode] ?? (() => this.#submitPassword(fields)))();
  }
  ```

  Update the JSDoc `@param mode` list and add `@param resetToken`.
- Add `#submitRecover(fields)`: `this.setSubmitError(null)`, then
  `try { await this.client.recover(fields.email); } finally { this.setResultPanel('recover'); }`
  — the `finally` is the enumeration-safety contract, mirroring the old
  `RecoverController.handleSubmit`.
- Add `#submitResetPassword(fields, token)`: run `resetPasswordValidator.validate(fields)`,
  `this.setFieldErrors(errors)`, bail if non-empty; else `this.setSubmitError(null)`, then
  `try { await this.client.resetPassword({ token, ...fields }); this.setResultPanel('resetPassword'); }
  catch (error) { this.setSubmitError(error.message); }`. Must **not** call `#handleSuccess`,
  `AuthEvents.emit`, `LoginModalEvents.close`, or `#redirectHome`.
- Update the class-level JSDoc to describe all four modes.

## Files to Change

- `frontend/assets/js/components/common/loginModal/controllers/LoginModalController.js` — new
  `setResultPanel` ctor arg, `MODES` entries, shared `resetPasswordValidator`, `switchMode`
  clears the panel, dispatch-map `handleSubmit`, `#submitRecover`, `#submitResetPassword`.
