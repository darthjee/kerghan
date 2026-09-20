# Migrate MyAccountControllerSpec

Rewrite `MyAccountControllerSpec.js` to call the shared example group with the MyAccount options (`MyAccountController`, `'updateAccount'`, blank fields including `currentPassword: 'secret'`, identity `wrapResponse`, `submit` = `controller.handleSubmit(fields)`, expected call `[{ currentPassword: 'secret', ...payload }]`), and delete the spy setup and every case now covered by it.

Keep only the MyAccount-specific cases, reusing the context/spies the shared module provides:

- `#validate`: flags a missing current password; a form with only the current password filled in returns no errors.
- `#handleSubmit`: invalid form (missing current password) sets `currentPassword` field errors and skips the API call; the success updater also clears `currentPassword` (full `toEqual` including `currentPassword: ''`); stores the submit error on a wrong current password and leaves fields/success untouched.

## Files to Change
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/MyAccountControllerSpec.js` — replace the duplicated cases and setup with the shared example group; keep the MyAccount-only cases above.
