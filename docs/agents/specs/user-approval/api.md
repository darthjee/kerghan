# User approval — API

Every changed and new endpoint. User endpoints are built by #392, admin endpoints by #393.
Index: [README.md](README.md).

## Conventions

- **Error body:** the standard shape from `backend/src/core/http-exception.filter.ts`,
  `{ error: { code, message, details? }, statusCode, timestamp }`.
- **Specific codes** are new `ErrorCodes` entries (`backend/src/core/error-codes.ts`), attached
  at the throw site, e.g. `new ForbiddenException({ code: ErrorCodes.USER_DENIED, message })`.
  New codes: `USER_DENIED`, `USER_NOT_PENDING`, `CANNOT_DENY_SELF`.
- **Revoked reason:** new `RevokedReason.ADMIN_DENIED = 'admin_denied'`
  (`backend/src/auth/entities/refresh-token.entity.ts`).
- **Cache policy:** every route below is `@CachePolicy(CacheClass.Never)` (already the case for
  the auth and admin controllers, at controller level), so it sends `X-Skip-Cache: true` and
  `Cache-Control: no-store`.
- **Thin controllers:** status rules live in the services (`AuthService`, `PasswordResetService`,
  `AuthorizationRequestService`, `AdminService`), never in the controllers.

## User endpoints

### `POST /auth/register.json`

- Creates the user with the status given by `KERGHAN_USER_APPROVAL_REQUIRED` (see
  [model.md](model.md#registration)).
- Response and cookies **unchanged** for every status: `200 { user }` plus the session cookies.
  A pending user therefore holds a session, blocked by the gate, that becomes usable the moment
  an admin approves.

### `POST /auth/login.json`

Order of checks:

1. Unknown username or wrong password → the existing `401`, unchanged, whatever the status.
2. Correct password, user `denied` → **`403 USER_DENIED`**, no session minted, no cookie set.
3. Correct password, user `pending` → the normal `200 { user }` with a session, blocked by the
   gate.
4. Correct password, user `approved` → unchanged.

`USER_DENIED` body:

```json
{
  "error": {
    "code": "USER_DENIED",
    "message": "This account has been denied access"
  },
  "statusCode": 403,
  "timestamp": "<ISO 8601>"
}
```

A `403` does not trigger `ApiClient`'s refresh-and-retry (only `401` does).

### `POST /auth/status.json`

Extends the existing contract ([Auth routes](../../backend/routes/auth.md#post-authstatusjson):
`{ loggedIn, isAdmin }`, always `201`):

| Caller | Body | Session cookies |
|---|---|---|
| Active session, user `approved` | `{ loggedIn: true, isAdmin }` (unchanged) | unchanged |
| Active session, user `pending` | `{ loggedIn: false, isAdmin: false, status: "pending" }` | **kept**: the session must survive to pick up approval without a new login |
| Active session, user `denied` (should not happen: deny revokes every session) | treated as no valid session: falls through to the next row's flow (including automatic login), so the answer is byte-for-byte what an anonymous caller gets | cleared, unless automatic login sets new ones; the presented token, if still active (racing the deny), is revoked with `admin_denied`, as on `refresh.json` |
| No valid session (including a denied user, whose sessions were revoked) | existing flow: automatic login when enabled and the IP is allowed, otherwise `{ loggedIn: false, isAdmin: false }` | as today |

- `status` appears **only** for `pending`. Logged-out and denied stay byte-for-byte the
  unauthenticated response, so nothing reveals that an account is denied.
- The pending answer is the one `loggedIn: false` answer that does **not** clear the session
  cookies.
- Automatic-login precedence is unchanged ("a valid refresh cookie wins, whoever its user is"):
  a pending user's own session wins over automatic login; a denied user's session (normally
  already revoked) counts as no valid session, so automatic login applies as for any visitor. The default user is always `approved`
  (see [model.md](model.md#default-user)).

### `POST /auth/refresh.json`

- **`pending`:** keeps rotating the session normally, so it stays alive and becomes usable the
  moment the user is approved. The access tokens it mints are blocked by the gate meanwhile.
- **`denied`:** the presented token is rejected with the plain `401` (cookies cleared, no replay
  detection), and that token, if still active, is revoked with `admin_denied`. Deny already
  revokes every active token, but a rotation or winning poll racing the deny's bulk revoke can
  insert a new active row after it; this check stops such a session from rotating on.
- **`approved`:** unchanged.

Order of checks: the existing token checks run first, unchanged (unknown / expired → `401`; a
revoked `rotated` token → replay detection; any other revoked token → plain `401`). The status
check applies only to a token that passed them (still active), so replay detection is never
skipped for a denied user.

### `POST /auth/recover.json`

Identical observable behavior for every status: always `200 { sent: true }`.

- `approved` and `pending`: unchanged (token created, email sent). A pending user may reset their
  password.
- `denied`: treated like an unknown email: no token created, no email sent.

### `POST /auth/reset-password.json`

- Token errors first, unchanged.
- A valid token for a `denied` user → the same generic error as an unknown or expired token
  (`400`, "Invalid or expired token"); the password is unchanged and the token is **not
  consumed** (it simply expires), as in the default-user precedent. This covers tokens issued
  before the deny.
- A valid token for a `pending` user resets the password as today; the user stays `pending`.
- The default user's existing `409 DEFAULT_USER_MANAGED` rule is unchanged (the default user is
  never denied).

### Device authorization

- **`POST /auth/authorization-requests/:uuid/authorize.json`:** no change. It is authenticated,
  so the gate answers a non-approved caller with `401` before the endpoint runs. It keeps
  reporting every business rejection as `400`, never `401` / `403`.
- **`POST /auth/authorization-requests/:uuid/poll.json`:** the winning poll still claims the
  request atomically first (the existing guarded `UPDATE ... WHERE status = 'approved'`,
  `approved → logged`). Then, **on the freshly loaded user row, right before minting the
  tokens** (inside the session-issuing step), it re-checks the user's status. A user who is not
  `approved` (e.g. denied between `authorize` and `poll`, or between the claim and the mint)
  never receives a session: a conditional `UPDATE ... WHERE status = 'logged'` flips the request
  to `denied`, and the poll answers `{ status: "denied" }`, no `user`, no cookies. This is a
  **new request transition, `logged → denied`** (today only `open → denied` exists); #394 adds
  it to the status machine in `modules/auth.md`. A deny landing after the tokens were minted is
  covered by the deny revocation and the gate.
- `POST /auth/authorization-requests.json` (create), `mine.json` and the request `deny.json`:
  no change (`mine` / `deny` are gated like any authenticated route).

## Admin endpoints

All under `AdminController` (`/admin` prefix): default `JwtGuard` plus `@AdminOnly()`,
`@CachePolicy(CacheClass.Never)`, thin controller delegating to `AdminService`. **Always
available, whatever `KERGHAN_USER_APPROVAL_REQUIRED` says.**

### User item shape

Every admin user item gains `status`:

```text
{ id, username, email, isAdmin, createdAt, status }
```

Never the password digest, tokens or sessions.

### `POST /admin/users/search.json`

- Request body: `{ q?, status? }`.
- `status` is optional, one of `pending`, `approved`, `denied` (`@IsIn` on `SearchUsersDto`); any
  other value → `400 VALIDATION_FAILED` (existing `ValidationPipe` path).
- Combinable with `q`: both filters apply (AND). Absent `status` → every status.
- Response: `{ users: [ <user item> ] }`, still unpaginated.

### `POST /admin/users/:id/approve.json`

| Case | Response |
|---|---|
| Caller is not an admin | existing `AdminGuard` → `403 FORBIDDEN` |
| Unknown `:id` | `404 NOT_FOUND` |
| User is not `pending` | `422 USER_NOT_PENDING` (new), nothing changes |
| Success | `200 { user: <user item> }`, status `approved` |

Sessions are untouched: a pending user's existing session becomes usable on its next request.

### `POST /admin/users/:id/deny.json`

Order of checks:

| Case | Response |
|---|---|
| Caller is not an admin | existing `AdminGuard` → `403 FORBIDDEN` |
| Unknown `:id` | `404 NOT_FOUND` |
| `:id` is the default user | `409 DEFAULT_USER_MANAGED` (existing), nothing changes |
| `:id` is the caller | `422 CANNOT_DENY_SELF` (new), nothing changes |
| Success, from any status | `200 { user: <user item> }`, status `denied` |

On success, every **active** (unrevoked) refresh token of the user is revoked with
`revokedReason` `admin_denied`, through `TokenService#revokeUserTokens(userId, ADMIN_DENIED)`;
already-revoked rows keep their existing reason (replay evidence is preserved). `admin_denied`
is not `rotated`, so a later refresh of those tokens never triggers replay detection. Replaying
an older, unexpired `rotated` token of a denied user still triggers replay detection, which is
harmless (nothing active is left) and expected. Combined
with the gate, the user is logged out everywhere on their next request. Also applies when the
user is already `denied`.

Any admin may deny any other user, **other admins included**: only oneself and the default user
are protected (decision #389). This is accepted: through the API, one admin can deny every other
non-default admin, and the only way back is a DB change.

The default-user check applies while the default-user feature is enabled, with the same
identification (by id, `DefaultUserService#assertNotDefaultUser`) as
[Edit blocking](../../modules/auth/default-user.md#identifying-the-default-user). With the
feature off, that row is a regular user and can be denied.

### Other admin routes

`POST /admin/users/:id/edit.json`, `recovery-link.json` and `send-recovery-email.json` are
deliberately **unchanged** for every status: they are admin-only (the admin already sees the
status), they never change `status`, and a recovery token issued for a denied user is refused by
`reset-password.json`. Nothing about them is observable to the user beyond what an admin chooses
to send.

## Required tests

- **Register:** flag off → session usable; flag on → `200` with cookies, and the session is
  refused by the gate until approval.
- **Login:** wrong password on a denied user → `401`; correct password on a denied user →
  `403 USER_DENIED`, no cookies; pending → `200` with a session.
- **`status.json`:** one test per table row, including cookies kept for pending, cleared for
  denied, and automatic login applying to a caller whose denied session was revoked; `status`
  absent from every non-pending body.
- **Refresh:** a pending user's refresh rotates; a denied user's refresh → plain `401`, cookies
  cleared, no replay detection, and a still-active token (racing the deny) is revoked with
  `admin_denied`.
- **Recover / reset:** recover answers identically for each status and creates no token for a
  denied user; reset with a denied user's token → the generic invalid-token `400`, password unchanged, token not consumed; a pending user
  can reset and stays pending.
- **Device authorization:** `authorize` by a pending user → `401` from the gate; a user denied
  between `authorize` and `poll`, or after the claim but before the mint, gets
  `{ status: "denied" }`, no session, and the request ends `denied` (`logged → denied`).
- **Other admin routes:** `edit.json`, `recovery-link.json` and `send-recovery-email.json` on a
  denied user behave as for any user and leave `status` `denied`.
- **Search:** `status` filter alone and combined with `q`; invalid `status` →
  `400 VALIDATION_FAILED`; items carry `status` and no secret fields.
- **Approve:** `403` for a non-admin, `404`, `422 USER_NOT_PENDING` from `approved` and `denied`,
  `200` from `pending`.
- **Deny:** `403` for a non-admin, `404`, `409` on the default user, `422 CANNOT_DENY_SELF`,
  `200` from each status; every active refresh token revoked with `admin_denied`, already-revoked
  rows keep their reason.
- **Cache policy:** every changed or new route sends `X-Skip-Cache: true`. The `cache` agent
  confirms none of them belongs in the Navi warm-up resources (`navi/resources/*.yml`).
