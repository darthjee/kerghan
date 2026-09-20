# Add AccountEditFormController base class
Create the shared base class next to the existing shared `AccountEditFormHelper.jsx`, holding all logic that is currently duplicated. Suggested shape (names are a starting point, keep JSDoc on all public API):

- `constructor(setFields, setFieldErrors, setSubmitError, setSuccess, client)` — same as today.
- `async submit(fields, send)` — the shared flow: `validate` → `setFieldErrors`/`setSuccess(false)` → return on errors → `buildPayload` → if `!hasUpdate(payload)` set the "Provide a username, email, or new password to update." error and return → `setSubmitError(null)` → `try { result = await send(payload); if (!result) return; applySuccess(result) } catch (error) { handleSubmitError(error) }`. `send` is a callback so each subclass keeps its own `handleSubmit` signature.
- `validate({ email, newPassword, newPasswordConfirmation })` — current email + new password/confirmation rules and messages, unchanged (validator extraction is #167).
- `buildPayload({ username, email, newPassword })` — truthiness filter, never `newPasswordConfirmation`.
- `hasUpdate(payload)` — `username`/`email`/`newPassword` present.
- `applySuccess(result)` — `setFields` with `extractAccount(result)`'s username/email and `clearedFields()` reset, then `setSuccess(true)`.
- Overridable hooks with defaults: `extractAccount(result)` (default `result`), `clearedFields()` (default `newPassword`/`newPasswordConfirmation` → `''`), `handleSubmitError(error)` (default `setSubmitError(error.message)`).

Keep every method small enough for ESLint's max complexity 10.

## Files to Change
- `frontend/assets/js/components/common/forms/controllers/AccountEditFormController.js` — new base class
- `frontend/specs/assets/js/components/common/forms/controllers/AccountEditFormControllerSpec.js` — new spec covering the shared flow (validation errors block the call, nothing-filled error, success applies + clears, client error → `setSubmitError`, falsy result ignored) and each default hook, using a minimal fake subclass/`send` callback
