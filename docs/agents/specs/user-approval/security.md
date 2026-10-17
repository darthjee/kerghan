# User approval — Security

The authentication gate and the non-disclosure rules. Built by #391 (session lookup) and #392
(`approved` requirement and exceptions). Index: [README.md](README.md).

## `sid` claim

Every access token carries a `sid` claim: the `sessionUuid` of the refresh-token session it was
minted for (see [Sessions](../../backend/routes/auth.md#sessions)). Every path that mints an
access token (login, register, refresh, the winning device-authorization poll, automatic login on
`status.json`) sets it.

## Session lookup in `JwtGuard`

On every request that is not `@Public()`, after the existing signature and expiry check,
`JwtGuard` loads the **active** (not revoked, not expired) refresh-token row whose
`session_uuid` is the token's `sid`, joined to its user. It allows the request only when:

1. that row exists;
2. `row.userId === sub`;
3. the user's status is `approved` — **always**, whatever `KERGHAN_USER_APPROVAL_REQUIRED` says.

Otherwise it answers `401`. Every new rejection (no row, `userId` mismatch, non-approved
status, missing or malformed `sid`) throws the **same** `UnauthorizedException` as the existing
invalid / expired access-token path, with the same message and no status-specific code, so it
is indistinguishable from an invalid or expired token. It is one indexed query
(`session_uuid` is already indexed) per authenticated request.

**Claim validation:** before the query, the token is treated as invalid (`401`, same response)
unless `sid` is a string holding a well-formed UUID and `sub` is a number; a non-string claim is
never passed into the query. `sid` is added to `AccessTokenPayload`
(`backend/src/core/access-token-payload.ts`) and to the `request.user` type.

Rotation keeps working: `POST /auth/refresh.json` copies `session_uuid` onto the replacement
token, so the session stays active across rotations and the `sid` keeps matching.

## `request.user` from the DB

After the lookup, `JwtGuard` builds `request.user` = `{ sub, sid, username, isAdmin }` from the
**joined user row**, not from the JWT claims. No extra query: the lookup already joins the user.

- `AdminGuard` and `@CurrentUser()` stay unchanged and always see current values.
- An admin demotion (today through the default-user boot sync driven by
  `KERGHAN_DEFAULT_USER_ADMIN`, or a manual DB change) and a username change take effect on the
  next request, instead of after the access-token TTL.
- The JWT keeps carrying `username` and `isAdmin`, but they are no longer trusted for
  authorization.

## Tokens without `sid`

**`JwtGuard` rejects any access token without a `sid` claim with `401`.** No legacy code path.

- This logs no one out: the session is the refresh-token row, which the deploy does not touch.
  On a `401`, the frontend's `ApiClient` already refreshes (`POST /auth/refresh.json`) and
  retries the request once (`frontend/assets/js/client/ApiClient.js`); the refresh mints a
  `sid`-bearing access token for the same session. Device-authorization sessions use the same
  cookies and refresh flow.
- Only a client that never refreshes on `401` sees a single `401` after the deploy.
- Rejected alternative: accepting `sid`-less tokens with a user-id-only lookup until they
  expire. It is a temporary second path to remove later, and it would let those tokens bypass
  the session-revocation check for up to one access-token TTL, for no user-visible benefit.

## Delivery order

- **#391** ships the `sid` claim, the session lookup (rules 1 and 2) and `request.user` from the
  DB, with no status logic.
- **#392** adds rule 3 (the `approved` requirement), together with the `status` column and its
  `approved` backfill (see [model.md](model.md#migration)).

## Explicit exceptions

Business endpoints never check status: the gate does. Only these auth endpoints read the real
status, each with the behavior defined in [api.md](api.md):

| Endpoint | Why it reads the status |
|---|---|
| `POST /auth/login.json` | `denied` → `403 USER_DENIED`, only after the password is verified |
| `POST /auth/status.json` | Reports `pending` so the frontend can show the awaiting-approval view |
| `POST /auth/recover.json`, `POST /auth/reset-password.json` | Must never reveal the status; a denied user cannot reset |
| `POST /auth/authorization-requests/:uuid/poll.json` | Never mints a session for a non-approved user |
| `POST /auth/refresh.json` | Rejects a denied user's token; keeps rotating a pending user's session |

`POST /auth/refresh.json` is `@Public()`: it keeps rotating a pending user's session (the access
tokens it mints are blocked by the gate), and rejects a denied user's token with the plain `401`
as defense in depth against a rotation racing the deny's revocation (see
[api.md](api.md#post-authrefreshjson)).

## Non-disclosure

- A **denied** account is indistinguishable from a logged-out or unknown one everywhere, except
  login **after a correct password** (`403 USER_DENIED`). A wrong password keeps the existing
  `401`, so the denied status cannot be probed without the password.
- `status.json` reveals only `pending`, and only to the holder of that user's valid session.
- Password recovery has identical observable effects (response, timing class, side effects
  visible to the caller) for every status.

## Immediate effects

Because the gate checks the session and the user on every request, these take effect on the
**next request**, not after the access-token TTL: deny, logout, session revoke
(`sessions/:uuid/revoke.json`), revoke-others, password-change revocations, admin demotion and
username change.

This makes several documented caveats false; #394 rewrites each of them:

- [Auth routes](../../backend/routes/auth.md#post-authsessionsuuidrevokejson): "Revocation
  stops the refresh token only" (a revoked session's access token stays valid until it expires).
- [Auth module](../../modules/auth.md): `AdminGuard` reading `isAdmin` from the JWT with no DB
  lookup, and an admin demotion taking effect on the next refresh; the logout caveat; the
  password-change caveat; the session-revoke caveat.

## Required tests

- **Gate:** an active session of the token's `sub` passes; a revoked session, an expired
  session, an unknown `sid` and another user's session (`row.userId !== sub`) all answer `401`.
- **Missing or malformed `sid`:** a validly signed token without `sid`, with a non-string or
  non-UUID `sid`, or with a non-numeric `sub` answers `401`; after a refresh the retried request
  passes.
- **Rotation:** a token minted by refresh carries the same `sid` and passes.
- **Status (#392):** a `pending` or `denied` user's otherwise valid token answers `401` on a
  business endpoint, with the flag on and off.
- **`request.user` from the DB:** after demoting a user in the DB, the next request is refused by
  `AdminGuard`; after a username change, `@CurrentUser()` returns the new username.
- **Immediate revocation:** after logout, session revoke or deny, the old access token answers
  `401` on the next request.
- **Non-disclosure:** on business endpoints, a denied or pending user's request is answered
  byte-for-byte like one carrying an invalid or expired access token (a caller with no cookie
  gets the different "missing access token" message, so compare against the invalid-token
  response); on `status.json`, a denied user gets byte-for-byte the anonymous answer.
