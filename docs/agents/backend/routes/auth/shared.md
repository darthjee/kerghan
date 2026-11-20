# Routes — Auth: Shared behavior

Part of the [Auth routes](../auth.md) reference. Covers the default-user `409`, user status, shared caching behavior and session cookies.

## Default user `409` (`DEFAULT_USER_MANAGED`)

While the default-user feature is enabled (`KERGHAN_DEFAULT_USER_ENABLED` or
`KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED`), a write of a managed field (`username`, `email`,
`newPassword`) of the default user is refused. Rules, order of checks and rationale:
[Edit blocking](../../../modules/auth/default-user/edit-blocking.md).

| Route | Default-user behavior |
| --- | --- |
| `PATCH /auth/account.json` | `409` when the body contains any managed field, even with the stored value. A handle-only edit passes the block and is applied (`200`); a mixed edit is refused whole, the handle is not stored either. Runs right after the `400` "no field present" check, before the lockout (`423`) and the `currentPassword` check; never counts as a failed attempt and leaves an existing lockout untouched. |
| `POST /auth/recover.json` | Unchanged `200 { sent: true }`, as for an unknown email. No token is created and no email is sent. |
| `POST /auth/reset-password.json` | Token errors first, unchanged. A valid token for the default user → `409`; the password is unchanged and the token is not consumed. |
| `POST /admin/users/:id/edit.json`, `recovery-link.json`, `send-recovery-email.json` | `409` after the `404` for an unknown id; nothing is written, no token created, no email sent. See [the Auth module](../../../modules/auth/routes.md#admin-tool-routes-admincontroller-admin-prefix). |

Response body (the standard shape from `http-exception.filter.ts`, no `error.details`):

```json
{
  "error": {
    "code": "DEFAULT_USER_MANAGED",
    "message": "This user is managed by environment configuration and cannot be edited"
  },
  "statusCode": 409,
  "timestamp": "<ISO 8601>"
}
```

The message is the same on every route and never names the variables or their values. With the
feature off, every route answers as before.

## User status

Every user has a `status` (`pending`, `approved`, `denied`); only `approved` users pass the
session gate. Model, rules and rationale:
[User approval](../../../modules/auth/user-approval.md). The per-route effects are under each route
in the [login](login.md), [authorization requests](authorization-requests.md) and [sessions and account](sessions-and-account.md) pages, plus these two password-recovery routes:

| Route | Status behavior |
| --- | --- |
| `POST /auth/recover.json` | Always `200 { sent: true }`, the same observable answer for every status. `approved` and `pending`: unchanged (token created, email sent), so a pending user may reset their password. `denied`: treated like an unknown email, no token created and no email sent. |
| `POST /auth/reset-password.json` | Token errors first, unchanged, then the default user's `409`. A valid token for a `denied` user → the same generic `400` (`Invalid or expired token`) as an unknown or expired token; the password is unchanged and the token is **not consumed** (it simply expires). This covers tokens issued before the deny. A valid token for a `pending` user resets the password as usual; the user stays `pending`. |

New error codes (`backend/src/core/error-codes.ts`), attached at the throw site:

| Code | Status | Where |
| --- | --- | --- |
| `USER_DENIED` | `403` | `POST /auth/login.json`, correct password on a denied user (above) |
| `USER_NOT_PENDING` | `422` | `POST /admin/users/:id/approve.json` on a non-pending user ([Admin tool routes](../../../modules/auth/routes.md#admin-tool-routes-admincontroller-admin-prefix)) |
| `CANNOT_DENY_SELF` | `422` | `POST /admin/users/:id/deny.json` on the caller's own id ([Admin tool routes](../../../modules/auth/routes.md#admin-tool-routes-admincontroller-admin-prefix)) |

## Shared behavior

All thirteen routes in the [login](login.md), [authorization requests](authorization-requests.md) and [sessions and account](sessions-and-account.md) pages (the five classic ones, the five device-authorization ones and the
three session ones) are
declared `@CachePolicy(CacheClass.Never)` at controller level, so they send
`X-Skip-Cache: true` and `Cache-Control: no-store` on the response. Tent's
`default_proxy` rule caches any 2xx `*.json` response keyed only by query
string, regardless of HTTP method — since these POST routes carry no
query string, an uncapped response could otherwise be cached after the
first login/register/refresh/authorization-request call and served verbatim (credentials
included) to a different caller.

See [API Caching](../../../architecture/caching.md) for the general strategy.

## Session cookies

Every session-minting response (login, register, refresh and the winning
`POST /auth/authorization-requests/:uuid/poll.json`) goes through the shared `respondWithSession`
helper (`auth/auth-response.ts`), which calls `setSessionCookies` (`auth/auth-cookies.ts`), so
the response bodies/cookies cannot drift apart. An automatic login on `status.json` calls
`setSessionCookies` directly, so it sets the same cookies. All three cookies are `Secure` and
`SameSite=Strict`:

| Name | httpOnly | Path | Value | maxAge |
| --- | --- | --- | --- | --- |
| `access_token` | yes | `/` | JWT | `KERGHAN_ACCESS_TOKEN_TTL_MS` (default 15 minutes — matches JWT expiry; see `docs/agents/environment-variables.md`) |
| `refresh_token` | yes | `/auth` | raw refresh token | `expiresAt - now` of the minted refresh-token row (7 days regular, 30 days persistent by default) |
| `logged_in` | **no** | `/` | `1` | same as `refresh_token` |

Neither token is ever returned in a response body. `logged_in` carries no secret: it only lets
the frontend decide, without a request, whether to show the logged-in UI optimistically.

`clearSessionCookies` clears all three, each with the same `path`/`secure`/`sameSite` it was set
with (browsers ignore a clear on a different path). It runs on `logoff.json`, on a `401` from
`refresh.json` and on a `status.json` answering `loggedIn: false` (except the pending answer,
which keeps them).
