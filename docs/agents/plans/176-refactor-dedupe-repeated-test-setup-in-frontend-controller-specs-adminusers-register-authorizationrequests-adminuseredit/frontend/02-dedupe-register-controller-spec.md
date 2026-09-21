# Dedupe RegisterControllerSpec
Add a local `buildController()` returning `new RegisterController(setFieldErrors, setSubmitError, client)` and use it in every `#validate` and `#handleSubmit` case.

In `#validate`, turn the "flags a missing/malformed ..." cases into a table of `{ description, override, field }` rows (username missing, email missing, email malformed, password missing, password confirmation missing, password confirmation mismatched) driving one `it` per row that asserts `controller.validate({ ...validFields, ...override })[field]` is defined. Keep the "returns no errors for a valid form" case separate.

In `#handleSubmit`, share the setup of the two success cases ("clears field errors and redirects home on success", "emits the logged-in auth state on success"): a small local helper (or `describe` with `beforeEach`) that stubs `client.register` with a resolved `{ user, refreshToken }`, builds the controller and installs the fake `window`. The two cases differ only in the `isAdmin` value and their assertions, which stay unchanged. Keep the invalid-form and request-failure cases as they are (apart from `buildController()`).

## Files to Change
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/RegisterControllerSpec.js` — add `buildController()`, table-driven `#validate` cases, shared success setup
