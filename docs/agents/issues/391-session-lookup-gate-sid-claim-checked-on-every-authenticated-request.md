# Issue: Session-lookup gate: sid claim checked on every authenticated request

## Description

Second sub-issue of the user approval Epic (#389). Make every authenticated request check that
its session is still active, by adding a `sid` claim to the access token and a session lookup in
`JwtGuard`. The behavior is defined in
[`docs/agents/specs/user-approval/security.md`](../specs/user-approval/security.md) (written by
#390); this issue builds the `sid` claim, rules 1 and 2 of the gate and `request.user` from the
DB. It adds **no** status logic.

## Problem

Today the access token (`{ sub, username, isAdmin }`, default TTL 15 minutes) is verified only by
its signature (`backend/src/core/jwt.guard.ts`), and `request.user` is the JWT payload as-is. So:

- a revoked session (logout, session revoke, revoke-others, password-change revocations) keeps
  working until its access token expires;
- an admin demotion or a username change only takes effect after the access-token TTL, because
  `AdminGuard` and `@CurrentUser()` read the stale JWT claims.

## Expected Behavior

- Every access token carries a `sid` claim: the `sessionUuid` of the refresh-token session it was
  minted for. All minting paths go through `TokenService#issueTokens` (login, register, refresh,
  winning device-authorization poll, automatic login on `status.json`), so all of them set it;
  on rotation the copied `sessionUuid` keeps the same `sid`.
- `JwtGuard`, on every non-`@Public()` request, after the existing signature/expiry check
  (current key, then retired keys):
  1. validates the claims: `sid` must be a string holding a well-formed UUID and `sub` a number,
     otherwise `401` (a non-string claim never reaches the query);
  2. loads the **active** (not revoked, not expired) refresh-token row with `session_uuid = sid`,
     joined to its user, in one indexed query;
  3. allows the request only if the row exists and `row.userId === sub`.
- Every new rejection (no row, `userId` mismatch, missing or malformed `sid`/`sub`) throws the
  **same** `UnauthorizedException` as the existing invalid/expired-token path (same message, no
  distinct code).
- Access tokens without `sid` (minted before the deploy) are rejected with `401`, with no legacy
  path; the frontend `ApiClient` already refreshes and retries once, so no one is logged out.
- `request.user` = `{ sub, sid, username, isAdmin }` is built from the **joined user row**, not
  from the JWT claims. `AdminGuard` and `@CurrentUser()` stay unchanged and see current values.
  The JWT keeps carrying `username`/`isAdmin`, but they are no longer trusted.

## Solution

- `AccessTokenPayload` (`backend/src/core/access-token-payload.ts`) gains `sid: string`, and the
  `request.user` type (`express.d.ts`) gains it too.
- `TokenService#issueTokens` resolves the `sessionUuid` once and uses it both in the signed
  payload (`sid`) and on the saved refresh-token row.
- **Module boundary:** `core/` never imports `auth/`, and this stays true. `core/` defines a
  session-lookup interface plus its injection token (e.g. `SessionLookup` /
  `SESSION_LOOKUP`, returning the active session's `userId` and joined user, or `null`).
  `AuthModule` provides and exports the implementation: the query lives in an auth service, not
  in the guard. `JwtGuard` depends only on the core abstraction.
- `JwtGuard#canActivate` becomes async: verify signature → validate claims → session lookup
  through the injected abstraction → build `request.user` from the joined user. A database
  error during the lookup propagates (`500`); it is not turned into a `401`.
- Test helpers that sign access tokens directly
  (`integrations/tests/support/build-integrations-test-app.ts`, `core/tests/app.module.spec.ts`,
  `core/tests/jwt.guard.spec.ts`, auth e2e support) are updated to mint tokens bound to a real,
  active session (or go through `issueTokens`).
- A security review (`security` agent) of the change, since it affects every authenticated
  request.

### Tests

From the spec's "Required tests" (the parts owned by this issue):

- **Gate:** an active session of the token's `sub` passes; a revoked session, an expired
  session, an unknown `sid` and another user's session (`row.userId !== sub`) all answer `401`
  with the invalid-token response.
- **Missing or malformed `sid`:** a validly signed token without `sid`, with a non-string or
  non-UUID `sid`, or with a non-numeric `sub` answers `401`; after a refresh the retried request
  passes.
- **Rotation:** a token minted by refresh carries the same `sid` and passes.
- **`request.user` from the DB:** after demoting a user in the DB, the next request is refused by
  `AdminGuard`; after a username change, `@CurrentUser()` returns the new username.
- **Immediate revocation:** after logout or session revoke, the old access token answers `401` on
  the next request.

### Out of scope

- User status / approval logic (rule 3, the `status` column, the flag): #392.
- Rewriting the documented caveats that this makes false (revocation stops the refresh token
  only, `AdminGuard` reading `isAdmin` from the JWT, logout / password-change / session-revoke
  caveats): #394.
- Slimming the JWT payload to `{ sub, sid }`.

## Benefits

- Logout, session revocation and password-change revocations take effect on the next request
  instead of after up to one access-token TTL.
- Admin demotion and username changes apply immediately.
- Provides the per-request session/user lookup that #392 extends with the `approved`
  requirement.
