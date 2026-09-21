# Add validation module
Create the shared validators as plain named-export functions (no class), split in two files.

**`utils/validation/fieldValidators.js`** — primitives, each returning an error map (`{}` when valid) so results can be spread into a controller's errors:
- `EMAIL_PATTERN` (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) and `MIN_PASSWORD_LENGTH` (`8`) exported constants, with a comment that `MIN_PASSWORD_LENGTH` mirrors the backend limit.
- `validateEmail(email, field = 'email')` — format check only: `{ [field]: 'Email is invalid' }` when it doesn't match `EMAIL_PATTERN`. Callers decide whether a blank email is an error.
- `validatePasswordLength(password, field = 'password')` — `{ [field]: 'Password must be at least 8 characters' }` (interpolating `MIN_PASSWORD_LENGTH`) when shorter.
- `validatePasswordConfirmation(password, confirmation, field = 'passwordConfirmation')` — match check only: `{ [field]: 'Passwords do not match' }` when they differ.

**`utils/validation/formValidators.js`** — composites for the two forms shared by a page controller and the login modal, built from the primitives and keeping today's exact required-field messages and ordering:
- `validateRegistration({ username, email, password, passwordConfirmation })` — `Username is required`; `Email is required` then `validateEmail`; `Password is required`; `Password confirmation is required`, else (when `password` is non-empty) `validatePasswordConfirmation`.
- `validateResetPassword({ password, passwordConfirmation })` — the password/confirmation subset of the above (same messages).

Add specs mirroring both files under `frontend/specs/assets/js/utils/validation/` (`fieldValidatorsSpec.js`, `formValidatorsSpec.js`): valid input → `{}`; each error case; custom field names; the composites cover the same cases the removed `ResetPasswordControllerSpec` and the existing `RegisterControllerSpec` `#validate` cases covered.

## Files to Change
- `frontend/assets/js/utils/validation/fieldValidators.js` — new: constants + `validateEmail`, `validatePasswordLength`, `validatePasswordConfirmation`
- `frontend/assets/js/utils/validation/formValidators.js` — new: `validateRegistration`, `validateResetPassword`
- `frontend/specs/assets/js/utils/validation/fieldValidatorsSpec.js` — new
- `frontend/specs/assets/js/utils/validation/formValidatorsSpec.js` — new
