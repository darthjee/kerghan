# Add session client methods
Add three methods to `AccountsClient`, each `ApiClient.postJson(...)` with `{ refreshToken: AuthSession.get() ?? undefined }` as the body (same convention as `updateAccount`), never touching `AuthSession` otherwise:
- `listSessions()` → `/auth/sessions/mine.json`, resolves `{ sessions: [...] }`.
- `revokeSession(uuid)` → `/auth/sessions/${uuid}/revoke.json`, resolves `{ revoked: true }`.
- `revokeOtherSessions()` → `/auth/sessions/revoke-others.json`, resolves `{ revoked: true }`.

Errors (`404`, `400`, ...) surface as thrown `ApiError`s, not caught here; a session-expired `401` resolves `undefined`, as for the other methods. Document the response shapes in JSDoc.

Specs: a new `AccountsClientSessionsSpec.js` (following `AccountsClientAuthorizationRequestsSpec.js`) asserting each URL and that the body carries the stored refresh token (and `undefined` when none is stored), and that the API result is returned.

## Files to Change
- `frontend/assets/js/client/AccountsClient.js` — add `listSessions`, `revokeSession`, `revokeOtherSessions`.
- `frontend/specs/assets/js/client/AccountsClientSessionsSpec.js` — new spec.
