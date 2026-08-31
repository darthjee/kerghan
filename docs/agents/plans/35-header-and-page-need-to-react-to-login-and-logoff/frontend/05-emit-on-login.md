# Emit on successful login

`LoginController.handleSubmit` (`frontend/assets/js/components/resources/accounts/pages/controllers/LoginController.js`)
currently only redirects home on a successful login. Add `AuthEvents.emit(true)`
alongside that, so the header (and anything else subscribed) picks up the new
logged-in state without relying on the redirect's forced re-render:

```js
async handleSubmit(fields) {
  this.setSubmitError(null);

  try {
    await this.client.login(fields);
    AuthEvents.emit(true);
    this.#redirectHome();
  } catch (error) {
    this.setSubmitError(error.message);
  }
}
```

## Files to Change

- `frontend/assets/js/components/resources/accounts/pages/controllers/LoginController.js`
  — add the `AuthEvents.emit(true)` call on successful login.
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/LoginControllerSpec.js`
  — cover that a successful submit emits `AuthEvents.emit(true)` before redirecting; a
  failed submit does not emit at all.
