# Pending on the auth bus

`AuthEvents.emit(loggedIn, isAdmin = false, pending = false)` adds `pending` to `detail`.
`HeaderController#checkStatus` reads `status` from `AccountsClient.status()` and emits
`(loggedIn, isAdmin, status === 'pending')`; with no `logged_in` hint it still emits
`(false, false, false)`. `buildAuthEffect` gains a `setPending` setter. Every existing
`emit(...)` call keeps working (default `false`).

Tests (ui.md "Bus"): a `status: "pending"` answer emits pending with `loggedIn` / `isAdmin`
false; other answers emit `pending: false`.

## Files to Change
- `frontend/assets/js/client/AuthEvents.js` — `pending` in the detail.
- `frontend/assets/js/components/common/header/controllers/HeaderController.js` — `checkStatus`.
- `frontend/assets/js/components/common/header/hooks/useAuthEffect.js` — `setPending`.
- matching specs under `frontend/specs/`.
