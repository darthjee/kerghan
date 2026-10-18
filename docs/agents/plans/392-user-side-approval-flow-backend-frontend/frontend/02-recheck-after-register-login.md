# Re-check status after register and login

Instead of emitting `AuthEvents.emit(true, result.user.isAdmin)` after a successful register or
login, call `AccountsClient.status()` and emit from its answer (`loggedIn`, `isAdmin`,
`status === 'pending'`). Then redirect home as today (the awaiting view takes over while
pending). Applies to `LoginModalController#handleSuccess` (password login, register mode and the
device-authorization success, which reuses it) and to `RegisterController#handleSubmit`. Extract
the "check status and emit" logic into one shared helper (e.g. a small `AuthStatus.refresh()` in
`client/`) reused by `HeaderController#checkStatus`, instead of duplicating it.

Tests (ui.md "Re-check"): register and login each call `status()` and route to logged-in or
pending from its answer.

## Files to Change
- `frontend/assets/js/components/common/loginModal/controllers/LoginModalController.js` — success handler.
- `frontend/assets/js/components/resources/accounts/pages/controllers/RegisterController.js` — success path.
- `frontend/assets/js/client/` — shared status-check helper (new), used by `HeaderController` too.
- matching specs under `frontend/specs/`.
