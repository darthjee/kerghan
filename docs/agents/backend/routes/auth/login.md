# Routes — Auth: Login, register, refresh, logoff and status

Part of the [Auth routes](../auth.md) reference. Covers `login`, `register`, `refresh`, `logoff` and `status`.

### `POST /auth/login.json`

| Property | Value |
| --- | --- |
| Controller | `AuthController` |
| Auth | `@Public()` |
| Request body | `LoginDto` — `{ username: string, password: string, keepSignedIn?: boolean }` |
| Success response | `{ user }` + sets the session cookies (see [Session cookies](shared.md#session-cookies)) |
| HTTP status | `200` (default); `401` for an unknown username or a wrong password; `403 USER_DENIED` for a denied user with the right password |

`user` is `{ id, username, email, isAdmin }` — `passwordDigest` is never serialized.

Order of checks ([user status](../../../modules/auth/user-approval.md#status-model)):

1. Unknown username or wrong password → the existing `401`, whatever the status.
2. Correct password, user `denied` → **`403 USER_DENIED`**, no session minted, no cookie set.
3. Correct password, user `pending` → the normal `200 { user }` with a session, which the
   session gate blocks until an admin approves.
4. Correct password, user `approved` → unchanged.

**Why the status is checked after the password:** the denied status must not be probed without
the password. `USER_DENIED` body (the standard error shape):

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

`keepSignedIn` is a strict optional boolean (omitted → `false`; any non-boolean such as `"true"`
or `1` → `400`). `true` mints a persistent refresh token (`KERGHAN_PERSISTENT_REFRESH_TOKEN_TTL_MS`,
default 30 days) whose flag is carried over on every refresh; see `docs/agents/modules/auth.md`.

### `POST /auth/register.json`

| Property | Value |
| --- | --- |
| Controller | `AuthController` |
| Auth | `@Public()` |
| Request body | `RegisterDto` — `{ username, password, email }` |
| Success response | `{ user }` + sets the session cookies |
| HTTP status | `200` (default) |

Creates a new `auth_users` record, then issues tokens identically to login. The new user's
`status` comes from `KERGHAN_USER_APPROVAL_REQUIRED` (off → `approved`, on → `pending`; see
[User approval](../../../modules/auth/user-approval.md#configuration)). The response and cookies are
the same for every status, so a pending user holds a session, blocked by the session gate, that
becomes usable as soon as an admin approves.

### `POST /auth/refresh.json`

| Property | Value |
| --- | --- |
| Controller | `AuthController` |
| Auth | `@Public()` |
| Request | `refresh_token` cookie. Temporary migration fallback (`TODO(#324-migration)`): optional body `RefreshFallbackDto` — `{ refreshToken?: string }`, used **only when the cookie is absent** (the cookie always wins) |
| Success response | `{ user }` + sets renewed session cookies |
| HTTP status | `200` (default); `401` (and all three session cookies cleared) when no token is sent or the token is rejected |

Rotates the `refresh_token` cookie's token server-side (old token's `revokedAt` is set, `revokedReason`
`rotated`). An unknown, expired or revoked token is rejected with `401`. Only an *unexpired*
token revoked by rotation triggers replay detection (every active token of the user is revoked,
reason `replay_detected`, forcing re-login everywhere); a token revoked for any other reason
(logout, session revoke, password change) or already expired gets a plain `401` with no side
effects — so a revoked device's routine refresh (or an attacker replaying its stolen token)
can't log the user out of their other sessions. See `revoked_reason` in
[the Auth module](../../../modules/auth/sessions.md#entities-auth_-table-prefix).

User status ([User approval](../../../modules/auth/user-approval.md#explicit-exceptions)):

- **`pending`:** the session keeps rotating normally, so it stays alive and becomes usable as
  soon as the user is approved. The access tokens it mints are blocked by the session gate
  meanwhile.
- **`denied`:** the presented token is rejected with the plain `401` (cookies cleared, no replay
  detection), and that token, still active, is revoked with `admin_denied`. **Why:** deny
  already revokes every active token, but a rotation or winning poll racing the deny's bulk
  revoke can insert a new active row after it; this check stops such a session from rotating
  on.
- **`approved`:** unchanged.

Order of checks: the existing token checks run first, unchanged (unknown or expired → `401`; a
revoked `rotated` token → replay detection; any other revoked token → plain `401`). The status
check applies only to a token that passed them (still active), so replay detection is never
skipped for a denied user.

The body fallback exists only so a frontend still holding a pre-#324 token in `localStorage`
(key `kerghan_refresh_token`) can migrate it into the cookie with one refresh. It lives in one
marked branch (`resolveRefreshToken` in `auth/auth-cookies.ts` plus `dto/refresh-fallback.dto.ts`)
and is to be removed once the migration window is over; no other route accepts a body token.

### `DELETE /auth/logoff.json`

| Property | Value |
| --- | --- |
| Controller | `AuthController` |
| Auth | `@Public()` |
| Request | `refresh_token` cookie (no body) |
| Success response | No body |
| HTTP status | `204 No Content` (also without a cookie) |

Revokes the cookie's refresh token server-side (when present) and always clears the
`access_token`, `refresh_token` and `logged_in` cookies.

### `POST /auth/status.json`

| Property | Value |
| --- | --- |
| Controller | `AuthController` |
| Auth | `@Public()` |
| Request | `refresh_token` cookie (no body); the client IP (for automatic login) |
| Success response | `{ loggedIn, isAdmin }`, plus `status: "pending"` for a pending user; sets the session cookies on an automatic login |
| HTTP status | `201` (Nest's `POST` default), always |

Reports whether the cookie's refresh token identifies an active session. Without automatic
login, a missing cookie answers `{ loggedIn: false, isAdmin: false }` without a database lookup.
A `loggedIn: false` answer clears the three session cookies, so the readable `logged_in` marker
can't outlive the session — except the pending answer below.

By the session user's [status](../../../modules/auth/user-approval.md#status-model):

| Caller | Body | Session cookies |
| --- | --- | --- |
| Active session, user `approved` | `{ loggedIn: true, isAdmin }` | unchanged |
| Active session, user `pending` | `{ loggedIn: false, isAdmin: false, status: "pending" }` | **kept** |
| Active session, user `denied` (should not happen: deny revokes every session) | treated as no valid session (next row), so byte-for-byte what an anonymous caller gets | cleared, unless automatic login sets new ones; the presented token, still active (racing the deny), is revoked with `admin_denied`, as on `refresh.json` |
| No valid session | automatic login when enabled and the IP is allowed (below), otherwise `{ loggedIn: false, isAdmin: false }` | cleared, or set by automatic login |

- `status` appears **only** for `pending`. A logged-out or denied caller gets byte-for-byte the
  unauthenticated response, so nothing reveals that an account is denied.
- The pending answer is the one `loggedIn: false` answer that keeps the session cookies. **Why:**
  the session must survive so the user can pick up an approval without logging in again.
- Revoking a denied user's token is the only write `status.json` makes.

**Automatic login.** When `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` is on (see
[Default user](../../../modules/auth/default-user.md#automatic-login)), a caller with **no valid
session** from an **allowed client IP** is logged in as the default user:

- **No valid session** means the `refresh_token` cookie is missing, unknown, expired or revoked
  (including a session revoked from another device). The access token is never read. A valid
  refresh cookie wins and follows the flow above unchanged, whoever its user is: a pending
  user's own session wins over automatic login, while a denied user's session counts as no
  valid session. The default user is always `approved`.
- **Allowed client IP** is the IP resolved through `KERGHAN_TRUSTED_PROXY_HOPS` (the same
  handling as `POST /auth/authorization-requests.json`), checked against
  `KERGHAN_DEFAULT_USER_ALLOWED_IPS` (loopback only by default).
- **Body:** exactly `{ "loggedIn": true, "isAdmin": <boolean> }`, with `isAdmin` from the default
  user. No extra field and no automatic-login indicator.
- **Cookies:** the same three session cookies `login.json` sets, through the same
  `setSessionCookies` helper (see [Session cookies](shared.md#session-cookies)).
- **Session:** a regular session, `keepSignedIn: false`, with the regular refresh TTL (never the
  persistent one). It is listed in `sessions/mine.json` like any password-login session and can
  be revoked the same way. No new columns or fields. When it expires, the next `status.json`
  simply logs in again.
- **Disallowed IP or feature off:** byte-for-byte the unauthenticated response,
  `201 { "loggedIn": false, "isAdmin": false }` with the session cookies cleared. Nothing hints
  that the feature exists.
- **Caching:** unchanged, `@CachePolicy(CacheClass.Never)` (`X-Skip-Cache: true`), see
  [Shared behavior](shared.md#shared-behavior).
- While automatic login is on, every boot logs a warning naming the default username and the
  effective allowlist (never the password).
