# New modes, tabs, fields, and result panels in the helpers

Teach `LoginModalFormsHelper` about the two new modes and render the result panels; add the
new titles to `LoginModalHelper`.

## What to do

### `components/common/loginModal/helpers/LoginModalFormsHelper.jsx`

- `FIELDS_BY_MODE`: add
  `recover: [['email', 'email', 'Email']]` and
  `resetPassword: [['password', 'password', 'New password'], ['passwordConfirmation', 'password', 'Confirm new password']]`.
  The existing `onChangeByField` map in `#renderForm` already covers `email` / `password` /
  `passwordConfirmation`, so no handler wiring changes.
- `MODE_TABS`: add `['recover', 'Recover']`. Do **not** add `resetPassword` — it is
  programmatic-only.
- `SUBMIT_LABELS`: add `recover: 'Send reset link'` and `resetPassword: 'Set new password'`.
- `#renderForm`: replace `const mode = state.mode === 'register' ? 'register' : 'password';`
  with a known-mode lookup, e.g.
  `const mode = FIELDS_BY_MODE[state.mode] ? state.mode : 'password';`.
- `render`: when `state.resultPanel` is set, render the panel instead of the selector + form:

  ```js
  static render(state, handlers) {
    if (state.resultPanel) {
      return <div>{LoginModalFormsHelper.#renderResultPanel(state.resultPanel, handlers)}</div>;
    }

    return (
      <div>
        {LoginModalFormsHelper.#renderModeSelector(state, handlers)}
        {LoginModalFormsHelper.#renderForm(state, handlers)}
      </div>
    );
  }
  ```

- Add `#renderResultPanel(panel, handlers)`:
  - `panel === 'resetPassword'` → a `<p>Your password has been updated.</p>` plus a
    `<button type="button" className="btn btn-link p-0" onClick={() => handlers.onSelectMode('password')}>Back to log in</button>`
    (port of `ResetPasswordHelper.#renderConfirmation`, with the anchor swapped for a
    mode-switch button since there is no `#/login` route anymore).
  - otherwise (`'recover'`) → a single neutral
    `<p>If that email matches an account, a reset link is on its way.</p>` (port of
    `RecoverHelper.#renderConfirmation`).
  - JSDoc with `@param` / `@returns` / `@description`.
- Update the `render` / class JSDoc to mention the result-panel branch and the two new modes.

### `components/common/loginModal/helpers/LoginModalHelper.jsx`

- `TITLES`: add `recover: 'Recover password'` and `resetPassword: 'Set a new password'`.
- `#title(mode)`: replace the `mode === 'register' ? … : …` ternary with
  `return TITLES[mode] ?? TITLES.password;`. Update JSDoc `@param mode`.
- Update the `render` JSDoc `state` shape to include `resultPanel`.

## Files to Change

- `frontend/assets/js/components/common/loginModal/helpers/LoginModalFormsHelper.jsx` — add
  `recover` / `resetPassword` to `FIELDS_BY_MODE` and `SUBMIT_LABELS`, add the `recover` tab
  to `MODE_TABS`, replace the mode fallback with a lookup, render `#renderResultPanel` when
  `state.resultPanel` is set.
- `frontend/assets/js/components/common/loginModal/helpers/LoginModalHelper.jsx` — add the two
  titles and switch `#title` to a `TITLES` lookup.
