# AuthorizationRequests page trio

New `AuthorizationRequests.jsx` page + `AuthorizationRequestsController.js` +
`AuthorizationRequestsHelper.jsx`, following the `AdminUsers` trio's page/controller/helper
split (state lives in the page component via `useState`, the controller owns
`AccountsClient` calls and error mapping, the helper is a pure render function).

**Critical detail carried over from `ApiClient` (verified in
`frontend/assets/js/client/ApiClient.js`): on a `401` with no usable refresh token,
`ApiClient.postJson` resolves with `undefined` instead of throwing** — it already opened the
login modal itself (`#sessionExpired`) before resolving. Every controller method below must
check for a falsy result and return early in that case (no destructuring crash, no
`setLoadError`/row-error call) — this is what "no separate login prompt" (per the refined issue)
actually relies on. A `400` business rejection, by contrast, *does* throw an `ApiError` and must
be handled as an error.

## Page state (`AuthorizationRequests.jsx`)

- `requests` (array, initial `[]`) — the current list.
- `loadError` (string|null) — set only on a genuine `load()` failure (not session-expiry).
- `rowState` (object keyed by `uuid`, initial `{}`) — per-row UI state:
  `{ open: boolean, password: string, error: string|null }`. `open` toggles the inline password
  field; `password` is the field's current value; `error` is set by the controller after a
  failed `authorize`/`deny` on that row.

## Controller (`AuthorizationRequestsController.js`)

- `constructor(setRequests, setLoadError, setRowState, client = AccountsClient)`.
- `load()` → `client.listAuthorizationRequests()`; guard `undefined` (see above) and return; on
  success `setRequests(requests)` and clear `loadError`; on a thrown `ApiError`,
  `setLoadError(error.message)`.
- `authorize(uuid, password)` → `client.authorizeAuthorizationRequest(uuid, password)`; guard
  `undefined` and return; on success, clear that row's `error` and call `load()` again (per the
  issue's "list reloads after either" requirement); on a thrown `ApiError` (the `400` case),
  store `error.message` against that row via `setRowState`, leaving the row (and its `open`
  state) in place.
- `deny(uuid)` → same shape as `authorize`, without a password argument/field.
- Mirror `AdminUsersController`'s private-helper style for the shared
  guard-and-set-row-error logic.

## Helper (`AuthorizationRequestsHelper.jsx`)

- `render(state, handlers)`: a heading, `loadError` alert (if any, mirroring
  `AdminUsersHelper.#renderSearchError`), then either "No pending authorization requests." (empty
  state) or a `Table` (import from `react-bootstrap/cjs/Table.js`, matching `AdminUsersHelper`)
  with one row per request.
- Each row shows: recorded IP (`requestIp`), User-Agent (`requestUserAgent`), and age computed
  from `createdAt` (see `frontend.md`'s Notes — plain `Date` math, whole minutes, e.g.
  `"5 min ago"`; a request under 1 minute old can read `"just now"`).
- Actions cell: a **Deny** button (`handlers.onDeny(uuid)`); an **Authorize** button that toggles
  `rowState[uuid].open` (`handlers.onToggleAuthorize(uuid)`) — when open, replace it with an
  inline password `<input type="password">` bound to `rowState[uuid].password`
  (`handlers.onPasswordChange(uuid)`) plus a **Confirm** button/form submit
  (`handlers.onConfirmAuthorize(uuid)`) that prevents default navigation and calls
  `controller.authorize(uuid, rowState[uuid].password)`.
- Render `rowState[uuid].error` inline under that row's actions when present (mirroring
  `AdminUsersHelper.#renderRowResult`'s error branch).

## Page component wiring (`AuthorizationRequests.jsx`)

- On mount (`useEffect` with an empty dependency array), call `controller.load()`
  unconditionally — no session/login check of any kind (see `frontend.md`'s Notes).
- `handlers.onToggleAuthorize(uuid)` / `onPasswordChange(uuid)` are pure `setRowState` updates
  local to the page (no controller/client call) — only `onConfirmAuthorize`/`onDeny` reach the
  controller.

## Files to Change

- `frontend/assets/js/components/resources/accounts/pages/AuthorizationRequests.jsx` — new.
- `frontend/assets/js/components/resources/accounts/pages/controllers/AuthorizationRequestsController.js`
  — new.
- `frontend/assets/js/components/resources/accounts/pages/helpers/AuthorizationRequestsHelper.jsx`
  — new.
- `frontend/specs/assets/js/components/resources/accounts/pages/AuthorizationRequestsSpec.js` —
  new: mirrors `AdminUsersSpec.js` — default state passed to the helper, handlers wired, mount
  triggers `load()`.
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/AuthorizationRequestsControllerSpec.js`
  — new: `load()` success/failure/session-expired-`undefined`; `authorize()` success (reloads),
  `400` failure (sets row error, no reload), session-expired-`undefined`; same three cases for
  `deny()`.
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/AuthorizationRequestsHelperSpec.js`
  — new: empty state, populated table with IP/User-Agent/age, toggle → inline password field,
  confirm/deny handler wiring, row error rendering.
