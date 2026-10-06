# Add SessionsController
Create `SessionsController`, modeled on `AuthorizationRequestsController`. Constructor takes React setters `setSessions`, `setLoadError`, `setRowState` (Map keyed by session id, `{ error }`), `setPageState` (`{ confirmingRevokeOthers: boolean, error: string|null }`) and an optional `client = AccountsClient`.

Methods (every falsy client result returns immediately without touching state — `ApiClient` already handled the expired session):
- `load()` — `client.listSessions()`; on success `setSessions(result.sessions)` and clear the load error; on throw, `setLoadError(error.message)`.
- `revoke(id)` — `client.revokeSession(id)`; on success clear the row error and `load()`; on throw, store the message on that row via `patchRow`.
- `requestRevokeOthers()` / `cancelRevokeOthers()` — toggle `confirmingRevokeOthers` on the page state (clearing its error).
- `confirmRevokeOthers()` — `client.revokeOtherSessions()`; on success close the confirmation, clear the page error and `load()`; on throw, keep the confirmation closed and store the message as the page-level error.
- `patchRow(id, patch)` — same immutable `Map` merge as the existing controller.

Specs: `SessionsControllerSpec.js` covering load success/failure/undefined, revoke success (reload)/failure (row error)/undefined, confirm flow open/cancel, and confirmRevokeOthers success (reload, closed)/failure (page error)/undefined.

## Files to Change
- `frontend/assets/js/components/resources/accounts/pages/controllers/SessionsController.js` — new controller.
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/SessionsControllerSpec.js` — new spec.
