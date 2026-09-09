# AccountsClient authorization-request methods

Add two static methods to `AccountsClient`, both routed through `ApiClient.postJson` like every
existing method, with `.json` path suffixes.

- `createAuthorizationRequest(username)` → `POST /auth/authorization-requests.json` with body
  `{ username }`. Returns the response `{ uuid, pollToken, expiresAt }` (`expiresAt` an ISO-8601
  string). Does **not** touch `AuthSession` — mirror the `recover` / `status` "never issues a
  refresh token" JSDoc note.
- `pollAuthorizationRequest(uuid, pollToken)` → `POST /auth/authorization-requests/${uuid}/poll.json`
  with body `{ pollToken }`. Returns `{ status, user?, refreshToken? }`. When
  `status === 'approved'`, call `AuthSession.set(result.refreshToken)` before returning, so the
  modal's success path is identical to `login`. For every other status (`open`, `denied`,
  `expired`, `logged`) return the result untouched. A wrong `uuid` / `pollToken` surfaces as an
  `ApiError` with `.status === 404` thrown from `ApiClient` — do not catch it here; let it
  propagate to the poller.

Extend `AccountsClientSpec.js` following its existing
`spyOn(ApiClient, 'postJson').and.resolveTo(...)` + `afterEach(() => AuthSession.clear())`
pattern: assert exact path + body for both methods; assert `AuthSession.get()` is set only after
an `approved` poll and left untouched for `open` / `denied` / `expired` / `logged` and for
`createAuthorizationRequest`.

## Files to Change

- `frontend/assets/js/client/AccountsClient.js` — add `createAuthorizationRequest` and
  `pollAuthorizationRequest`.
- `frontend/specs/assets/js/client/AccountsClientSpec.js` — cover both methods, including the
  `AuthSession.set` on `approved`.
