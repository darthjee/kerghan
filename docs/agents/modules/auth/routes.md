# Auth — Routes, CSRF and Exports

## Routes

See [Auth routes](../../backend/routes/auth.md) for the full per-endpoint reference (request/response
detail, HTTP status, source files).

All routes are `@Public()` (exempt from the global `JwtGuard`) and end in `.json`, per Tent's
routing convention (`docs/agents/architecture/backend.md`):

| Route | Body | Response |
|---|---|---|
| `POST /auth/login.json` | `{ username, password, keepSignedIn? }` | `{ user }` + session cookies |
| `POST /auth/register.json` | `{ username, email, password }` | `{ user }` + session cookies |
| `POST /auth/refresh.json` | — (`refresh_token` cookie; temporary `{ refreshToken? }` fallback, `TODO(#324-migration)`) | `{ user }` + session cookies; `401` clears them |
| `DELETE /auth/logoff.json` | — (`refresh_token` cookie) | `204 No Content`, clears the session cookies |
| `POST /auth/status.json` | — (`refresh_token` cookie) | `{ loggedIn, isAdmin }`, plus `status: "pending"` for a [pending user](user-approval.md); `loggedIn: false` clears the session cookies, except for a pending user |

The *session cookies* (all `Secure` + `SameSite=Strict`, set/cleared only through
`auth/auth-cookies.ts`) are the httpOnly `access_token` (`Path=/`, access-token TTL), the
httpOnly `refresh_token` (`Path=/auth`, expiring with the refresh-token row) and the
script-readable `logged_in=1` (`Path=/`, same expiry as `refresh_token`) that drives the
frontend's optimistic login state. No route returns or accepts the refresh token in a body,
except `refresh.json`'s migration fallback: only when the cookie is absent, it reads an optional
body `refreshToken` so a client can move a legacy `localStorage` token into the cookie once. The
cookie always wins. Remove the fallback (`RefreshFallbackDto` and the marked branch in
`resolveRefreshToken`) once the migration window closes. See
[Auth routes](../../backend/routes/auth.md#session-cookies).

`user` is always `{ id, username, email, isAdmin }` — `passwordDigest` is never serialized. `isAdmin`
is the only way the frontend can learn whether the logged-in user is an admin, since the
`access_token` cookie is `httpOnly`. `/auth/status.json`'s `isAdmin` is resolved from the token
row's user when `loggedIn` is `true`, and is always `false` when `loggedIn` is `false`. When
automatic login is on, `status.json` can also log a caller with no valid session in as the
default user; see [Default user](default-user.md).

### Admin tool routes (`AdminController`, `/admin` prefix)

Every route below requires the default `JwtGuard` behavior (no `@Public()`) plus `@AdminOnly()`
(applied once at the controller level) — see [Admin authorization](admin-and-events.md#admin-authorization) for what that enforces.
All of them are `@CachePolicy(CacheClass.Never)` (controller level), so they send
`X-Skip-Cache: true` and `Cache-Control: no-store`, for the same cross-caller-caching reason as
the routes above. They are always available, whatever `KERGHAN_USER_APPROVAL_REQUIRED` says.

| Route | Body | Response |
|---|---|---|
| `POST /admin/users/search.json` | `{ q?, status? }` | `{ users: [{ id, username, email, isAdmin, createdAt, status }], currentUserId }` |
| `POST /admin/users/:id/edit.json` | `{ username?, email?, newPassword? }` | `{ user }` (same item shape) |
| `POST /admin/users/:id/approve.json` | — | `{ user }` (same item shape), status `approved` |
| `POST /admin/users/:id/deny.json` | — | `{ user }` (same item shape), status `denied` |
| `POST /admin/users/:id/recovery-link.json` | — | `{ resetUrl }` |
| `POST /admin/users/:id/send-recovery-email.json` | — | `{ sent }` |

An admin user item never carries the password digest, tokens or sessions.

`search.json` matches `q` case-insensitively against `username`/`email` (TypeORM `ILike` on
both, `where: [...]`); an absent/empty `q` returns every account, unpaginated. `status`
(optional, one of `pending`, `approved`, `denied`, `@IsIn` on `SearchUsersDto`; any other value
→ `400 VALIDATION_FAILED`) filters by approval status and combines with `q` (AND). An absent
`status` returns every status. `currentUserId` is the calling admin's own id
(`@CurrentUser().sub`): it lets the admin page hide deny on the caller's own row, since
`status.json` exposes no user id. It discloses nothing the admin does not already know.

`approve.json` (`AdminService#approveUser`) answers `404` for an unknown id and
`422 USER_NOT_PENDING` when the user is not `pending`. `deny.json` (`AdminService#denyUser`)
answers `404`, then `409 DEFAULT_USER_MANAGED` for the default user, then
`422 CANNOT_DENY_SELF` for the caller's own id. On success it revokes every active refresh
token of the user (`admin_denied`). Full rules and rationale:
[User approval → Admin review](user-approval.md#admin-review). The other two
routes both mint a fresh `PasswordResetToken` via `PasswordResetService#issueToken` (shared with
self-service `recover()`) for the given `:id`, never invalidating that user's other outstanding
tokens, and `404`s when `:id` doesn't match an account. `send-recovery-email.json` additionally
calls `MailService.sendEmailTemplate(...)` directly and synchronously (not the fire-and-forget
`password-recovery.requested` event self-service uses), so the admin gets a real
`sent: true`/`false` result instead of a always-`true` response — `sent: false` covers both a
disabled mail transport and a thrown send error, never a `500`.

While the [default user](default-user.md) feature is enabled, `POST /admin/users/:id/edit.json`
(`AdminService#editUser`), `recovery-link.json` and `send-recovery-email.json` answer
`409 DEFAULT_USER_MANAGED` when `:id` is the default user (after the usual `404` for an unknown
id), and change nothing. See
[Edit blocking](default-user.md#edit-blocking).

All six admin routes are `@CachePolicy(CacheClass.Never)` (controller level), so they send
`X-Skip-Cache: true` and `Cache-Control: no-store` on the response. Tent's `default_proxy` rule
caches any 2xx `*.json` response keyed only by query string, regardless of HTTP method — since
these POST routes carry no query string, an uncapped response could otherwise be cached after
the first login/register/refresh and served verbatim (credentials/session token included) to a
different caller. See [API Caching](../../architecture/caching.md) for the general strategy.

## CSRF protection

Every mutating route above (`POST`/`PATCH`/`DELETE`), `@Public()` or not, is covered by the
global `OriginGuard` (`core/origin.guard.ts`), which runs before `JwtGuard` and rejects
cross-site requests with `403` based on `Sec-Fetch-Site`/`Origin`. Together with the
`SameSite=Strict` session cookies, this also blocks login CSRF on the unauthenticated
routes (`login.json`, `register.json`, `recover.json`, `reset-password.json`, `refresh.json`,
`status.json`, the device-authorization `create`/`poll`). See
[`docs/agents/architecture/security.md`](../../architecture/security.md#csrf) for the full decision
table, the accepted residual risks and the rules future changes must keep.

## Exports

Besides `AuthService` and Core's `SESSION_LOOKUP` implementation, the Auth module exports
`AccountHandleService`, so other modules read the GitHub handle without touching `auth_users`:
`getGithubHandle(userId)` (the stored, normalised handle or `null`) and
`lockExistingUser(userId, manager)` (a `SELECT … FOR SHARE` existence check inside the caller's
transaction). Both, and the handle's normalisation, validation and edit routes, are defined in
[GitHub handle](github-handle.md).


