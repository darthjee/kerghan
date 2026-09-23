# Helper: read rows from the Map
In `AuthorizationRequestsHelper#renderRow`, replace `rowState[request.uuid] ?? {}` with `rowState.get(request.uuid) ?? {}`. Update the JSDoc types for `rowState` from `object` to `Map` (lines 14, 47, 82).

In `AuthorizationRequestsHelperSpec.js`, the `buildState` default becomes `rowState: new Map()`, and the per-test fixtures become `new Map([['req-uuid', { ... }]])`.

## Files to Change
- `frontend/assets/js/components/resources/accounts/pages/helpers/AuthorizationRequestsHelper.jsx` — `.get()` read and JSDoc types.
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/AuthorizationRequestsHelperSpec.js` — Map fixtures.
