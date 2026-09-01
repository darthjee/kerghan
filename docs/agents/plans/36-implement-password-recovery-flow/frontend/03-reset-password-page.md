# Reset-password page

Add the token-carrying confirmation page: `ResetPassword.jsx` + `ResetPasswordController.js` +
`ResetPasswordHelper.jsx`, following `Register.jsx`'s three-file shape (new-password +
confirm-password fields, client-side validation) plus a token read from the URL and a
success/failure branch `Register` doesn't need.

**Token extraction** — a one-off parse local to `ResetPassword.jsx`, not a new shared router
feature (`Router.extractParams` handles path params like `/games/:id`, not query strings, and
stays untouched):

```js
function getTokenFromHash(hash = typeof window === 'undefined' ? '' : window.location.hash) {
  const queryString = hash.split('?')[1] || '';
  return new URLSearchParams(queryString).get('token');
}
```

Read once via `useMemo(() => getTokenFromHash(), [])` in `ResetPassword.jsx`, and passed to the
controller's `handleSubmit` alongside the form fields.

`ResetPasswordController` mirrors `RegisterController`'s validate-then-submit shape, minus the
username/email fields, plus a `resetDone` success state instead of a redirect:

```js
export default class ResetPasswordController {
  constructor(setFieldErrors, setSubmitError, setResetDone, client = AccountsClient) {
    this.setFieldErrors = setFieldErrors;
    this.setSubmitError = setSubmitError;
    this.setResetDone = setResetDone;
    this.client = client;
  }

  async handleSubmit(token, fields) {
    const errors = this.validate(fields);
    this.setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    this.setSubmitError(null);

    try {
      await this.client.resetPassword({ token, ...fields });
      this.setResetDone(true);
    } catch (error) {
      this.setSubmitError(error.message);
    }
  }

  validate({ password, passwordConfirmation }) {
    return {
      ...this.#validatePassword(password),
      ...this.#validatePasswordConfirmation(password, passwordConfirmation),
    };
  }

  // #validatePassword / #validatePasswordConfirmation: copy
  // RegisterController's private methods of the same name verbatim.
}
```

No redirect on success (unlike `Login`/`Register`'s `#redirectHome`) — `ResetPasswordHelper`
renders a confirmation message with a manual `<a href="#/login">` link instead, per the issue's
decision that the user re-authenticates deliberately with their new password.

`ResetPasswordHelper` renders three states: the form (mirroring `RegisterHelper`'s two-field
shape, minus username/email), the submit-error alert (mirroring `LoginHelper`'s), or — once
`resetDone` is `true` — the success message + login link, instead of the form.

## Files to Change

- `frontend/assets/js/components/resources/accounts/pages/ResetPassword.jsx` — new page
  component, as above.
- `frontend/assets/js/components/resources/accounts/pages/controllers/ResetPasswordController.js`
  — new controller, as above.
- `frontend/assets/js/components/resources/accounts/pages/helpers/ResetPasswordHelper.jsx` — new
  helper, as above.
- `frontend/specs/assets/js/components/resources/accounts/pages/ResetPasswordSpec.js` — new
  spec, including token extraction from a hash with a query string.
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/ResetPasswordControllerSpec.js`
  — new spec, mirroring `RegisterControllerSpec.js`'s validation cases plus the
  success/failure-after-submit cases from `LoginControllerSpec.js`'s shape (asserting
  `setResetDone(true)` on success and `setSubmitError(error.message)` on failure — never both).
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/ResetPasswordHelperSpec.js`
  — new spec covering all three render states.
