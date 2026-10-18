# Denied login message

In `LoginModalController`'s password-login `catch`, when `error.code === 'USER_DENIED'`, set the
submit error to "This account has been denied access." (use the backend `error.message` or a
constant, consistently with how other coded errors are shown). Any other error keeps the current
handling (wrong password stays the credentials error).

Tests (ui.md "Denied login"): a `403 USER_DENIED` from `login()` shows the denied message; a `401`
keeps the usual error.

## Files to Change
- `frontend/assets/js/components/common/loginModal/controllers/LoginModalController.js` — denied branch.
- matching spec under `frontend/specs/`.
