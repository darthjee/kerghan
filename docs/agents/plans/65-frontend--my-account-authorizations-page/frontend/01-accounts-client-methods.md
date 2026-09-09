# AccountsClient methods

Add the three approver-side methods to `AccountsClient`, wrapping the #61 endpoints. None of
these touch `AuthSession` (mirroring `createAuthorizationRequest`/`pollAuthorizationRequest`'s
non-`approved` branches) — only the requesting-device `pollAuthorizationRequest` mutates
`AuthSession`, on its winning poll.

- `listAuthorizationRequests()` → `POST /auth/authorization-requests/mine.json {}` → resolves
  with `{ requests: [{ uuid, requestIp, requestUserAgent, createdAt, expiresAt }] }` (verified
  against `AuthorizationRequestController#mine` / `AuthorizationRequestService#listOpenForUser`
  in `backend/src/auth/authorization-request.controller.ts` and `.service.ts`).
- `authorizeAuthorizationRequest(uuid, password)` →
  `POST /auth/authorization-requests/${uuid}/authorize.json { password }` → resolves with
  `{ authorized: true }`. A `400` (wrong password, wrong owner, wrong status, or expired — the
  backend collapses all of these into one message) surfaces as a thrown `ApiError`; do not catch
  it here, same as the existing methods.
- `denyAuthorizationRequest(uuid)` →
  `POST /auth/authorization-requests/${uuid}/deny.json {}` → resolves with `{ denied: true }`.
  Same `400`-as-thrown-`ApiError` behavior, no password in the body.

Follow the existing JSDoc style used by `createAuthorizationRequest`/`pollAuthorizationRequest`
in the same file.

## Files to Change

- `frontend/assets/js/client/AccountsClient.js` — add the three methods above, each a thin
  `ApiClient.postJson(...)` call (see `createAuthorizationRequest` for the shape).
- `frontend/specs/assets/js/client/AccountsClientSpec.js` — extend with specs for the three new
  methods: correct URL + body per method, resolved value passthrough, and (for
  `authorizeAuthorizationRequest`/`denyAuthorizationRequest`) that a rejected `ApiClient.postJson`
  call propagates untouched (no `AuthSession` interaction, unlike `pollAuthorizationRequest`).
