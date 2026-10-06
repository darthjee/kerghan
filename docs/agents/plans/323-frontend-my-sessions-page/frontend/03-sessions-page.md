# Add Sessions page and render helper
**`SessionsHelper.render(state, handlers)`** (`state = { sessions, loadError, rowState, pageState }`), in the same style as `AuthorizationRequestsHelper` (react-bootstrap `Table`, bootstrap classes):
- Heading "Sessions" inside `container mt-4`; load-error alert.
- Empty state `<p>No active sessions.</p>` when the list is empty.
- Table columns: Started, Last used, Actions. Dates via a small `formatDateTime(iso)` → `new Date(iso).toLocaleString()` (absolute, browser locale/timezone).
- Badges next to the start time: "Current session" (`text-bg-success`) when `current`, "Keep signed in" (`text-bg-info`) when `keepSignedIn === true`.
- Per-row **Revoke** button (`btn-sm btn-danger`) calling `handlers.onRevoke(id)`, not rendered when `current`; row error rendered under it.
- Page-level **Sign out all other sessions** control, rendered only when some session is `current` and at least one other session exists. Closed: a button calling `onRequestRevokeOthers`. Open: a short confirmation text with **Confirm** (`onConfirmRevokeOthers`) and **Cancel** (`onCancelRevokeOthers`) buttons. Page error shown below it.

**`Sessions.jsx`**: mirrors `AuthorizationRequests.jsx` — `useState` for the four pieces of state, `useMemo` controller, exported `buildLoadEffect(controller)` run in `useEffect`, and curried handlers delegating to the controller.

Specs: `SessionsHelperSpec.js` (render markup checks: rows, both badges, revoke absent on current row, revoke-others hidden with no current session or no other sessions, closed vs. confirming states, row/page/load errors, empty state) and `SessionsSpec.js` (render delegates to the helper with initial state, `buildLoadEffect` calls `load`, each handler calls the matching controller method), following `AuthorizationRequestsSpec.js` and its `renderCapturingHandlers` support.

## Files to Change
- `frontend/assets/js/components/resources/accounts/pages/helpers/SessionsHelper.jsx` — new render helper.
- `frontend/assets/js/components/resources/accounts/pages/Sessions.jsx` — new page component.
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/SessionsHelperSpec.js` — new spec.
- `frontend/specs/assets/js/components/resources/accounts/pages/SessionsSpec.js` — new spec.
