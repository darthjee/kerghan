# Dedupe AdminUsersControllerSpec
Add a local `buildController()` returning `new AdminUsersController(setUsers, setRowResults, setSearchError, client)` and use it in every case instead of repeating the constructor call.

Collapse the three "redirects home ... on a 403" cases (`#handleSearch`, `#handleGenerateLink`, `#handleSendEmail`) into one table-driven definition, e.g. rows of `{ method, args, clientMethod, assertUntouched }`, generating the case inside each method's existing `describe` (via a local helper called from each `describe`, or a loop that reuses the same `describe` titles) so full spec names stay unchanged. Each row keeps its own current assertion: `handleSearch` asserts `setSearchError` was not called with `'Forbidden'`; the other two assert `setRowResults` was not called. The redirect assertion (`fakeWindow.location.hash === '/'`) and the `installFakeWindow({ location: { hash: '' } })` call stay as they are, still paired with the existing `uninstallFakeWindow()` `afterEach`.

Leave the success and generic-error cases' assertions untouched (they may only switch to `buildController()`).

## Files to Change
- `frontend/specs/assets/js/components/resources/admin/pages/controllers/AdminUsersControllerSpec.js` — add `buildController()`, table-driven 403 case
