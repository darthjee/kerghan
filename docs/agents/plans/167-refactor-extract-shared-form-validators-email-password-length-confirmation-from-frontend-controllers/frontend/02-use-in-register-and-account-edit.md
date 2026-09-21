# Use validators in RegisterController and AccountEditFormController
Replace the local copies with the shared module, without changing behavior.

- `RegisterController`: drop `EMAIL_PATTERN` and the private `#validateUsername`/`#validateEmail`/`#validatePassword`/`#validatePasswordConfirmation` helpers; `validate(fields)` (still the public entry point used by `handleSubmit`) returns `validateRegistration(fields)`.
- `AccountEditFormController`: drop `EMAIL_PATTERN`/`MIN_PASSWORD_LENGTH`; keep the optional handling locally (blank email → `{}`, blank new password → `{}`) and delegate the rules: `validateEmail(email)`, then `validatePasswordLength(newPassword, 'newPassword')`, then `validatePasswordConfirmation(newPassword, newPasswordConfirmation, 'newPasswordConfirmation')`, preserving the current order (length error short-circuits the match check) and the "blank confirmation ⇒ Passwords do not match" behavior.
- Update the class JSDoc if it mentions the local rules. Existing `RegisterControllerSpec` and `AccountEditFormControllerSpec` (and the My Account / Admin User Edit controller specs) must pass unchanged — they act as the behavior-preservation guard.

## Files to Change
- `frontend/assets/js/components/resources/accounts/pages/controllers/RegisterController.js` — use `validateRegistration`, remove local helpers/constant
- `frontend/assets/js/components/common/forms/controllers/AccountEditFormController.js` — use `validateEmail`/`validatePasswordLength`/`validatePasswordConfirmation`, remove local constants
