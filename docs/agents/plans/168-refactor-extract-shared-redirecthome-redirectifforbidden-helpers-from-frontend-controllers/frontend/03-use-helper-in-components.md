# Use helper in the two components and fix doc comments
Replace the inline `if (typeof window !== 'undefined') { window.location.hash = '/'; }` blocks with a call to `redirectHome()` in `redirectToResetModal` (`ResetPasswordLanding.jsx`) and `redirectToModal` (`ModalRedirect.jsx`). Note that `ResetPasswordLanding.jsx` still keeps its own `typeof window` guard for the hash *read* in `getTokenFromHash` — leave that alone.

Update the `ApiClient.js` `#sessionExpired` doc comment, which says it guards "the same way `RegisterController#redirectHome` guards it", to reference the shared `redirectHome` helper instead (or reword so it no longer points at a removed private method). Then run lint and the full spec suite via docker-compose and confirm both are green with no edits to existing specs.

## Files to Change
- `frontend/assets/js/components/resources/accounts/pages/ResetPasswordLanding.jsx` — use `redirectHome()` in `redirectToResetModal`
- `frontend/assets/js/components/common/ModalRedirect.jsx` — use `redirectHome()` in `redirectToModal`
- `frontend/assets/js/client/ApiClient.js` — fix the stale `RegisterController#redirectHome` doc reference
