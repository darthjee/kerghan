# Send keepSignedIn from AccountsClient

Extend the two client calls so they forward the flag as a strict boolean.

- `login({ username, password, keepSignedIn })` posts `{ username, password, keepSignedIn }`, with
  `keepSignedIn` coerced via `Boolean(...)` (`undefined` → `false`) so the backend never receives a
  non-boolean.
- `createAuthorizationRequest(username, keepSignedIn = false)` posts
  `{ username, keepSignedIn }`, coerced the same way.
- Update the JSDoc for both methods.
- Specs: assert the posted body includes `keepSignedIn: true` when it is passed and `false` when it
  is omitted, for both methods.

## Files to Change

- `frontend/assets/js/client/AccountsClient.js` — add `keepSignedIn` to both request bodies.
- `frontend/specs/assets/js/client/AccountsClientSpec.js` — login body cases.
- `frontend/specs/assets/js/client/AccountsClientAuthorizationRequestsSpec.js` — create body cases.
