# Routes — Auth

Authentication and session management routes, served by two controllers under the `/auth`
prefix: `AuthController` (`auth/auth.controller.ts`, the four classic routes below — login,
register, refresh, logoff — all `@Public()`, since they exist to establish or renew credentials
and must be reachable without an already-valid access token) and
`AuthorizationRequestController` (`auth/authorization-request.controller.ts`, the five
device-authorization routes below — `create`/`poll` are `@Public()` for the same reason,
`mine`/`authorize`/`deny` require the default `JwtGuard`), and `SessionController`
(`auth/session.controller.ts`, the three session-management routes below, all requiring the
default `JwtGuard`).

Business logic lives in `AuthService` (`auth/auth.service.ts`) for the four classic routes,
`AuthorizationRequestService` (`auth/authorization-request.service.ts`) for the five
device-authorization routes, and `SessionService` (`auth/session.service.ts`) for the three
session routes; all three controllers are thin delegation layers.

## Endpoints

### `POST /auth/login.json`

| Property | Value |
| --- | --- |
| Controller | `AuthController` |
| Auth | `@Public()` |
| Request body | `LoginDto` — `{ username: string, password: string, keepSignedIn?: boolean }` |
| Success response | `{ user }` + sets the session cookies (see "Session cookies" below) |
| HTTP status | `200` (default) |

`user` is `{ id, username, email }` — `passwordDigest` is never serialized.

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

Creates a new `auth_users` record, then issues tokens identically to login.

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
[the Auth module](../../modules/auth.md#entities-auth_-table-prefix).

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
| Request | `refresh_token` cookie (no body) |
| Success response | `{ loggedIn, isAdmin }` |
| HTTP status | `201` (Nest's `POST` default), always |

Reports whether the cookie's refresh token identifies an active session, without mutating
anything server-side. A missing cookie answers `{ loggedIn: false, isAdmin: false }` without a
database lookup. A `loggedIn: false` answer clears the three session cookies, so the readable
`logged_in` marker can't outlive the session.

### `POST /auth/authorization-requests.json`

| Property | Value |
| --- | --- |
| Controller | `AuthorizationRequestController` |
| Auth | `@Public()` |
| Request body | `CreateAuthorizationRequestDto` — `{ username: string, keepSignedIn?: boolean }` |
| Success response | `{ uuid, pollToken, expiresAt }` |
| HTTP status | `200` (default) |

Creates a device-authorization request. Responds identically whether or not `username` matches a
real account (enumeration safety) — see `docs/agents/modules/auth.md`'s "Device-authorization
flow" for the full enumeration-safety and rate-limit contract. `pollToken` is returned once here
and never stored (only its SHA-256 hash is persisted). `keepSignedIn` follows the same strict
optional-boolean rule as on `POST /auth/login.json`; it is stored on the request and applied to the
session minted by the winning `approved` poll.

### `POST /auth/authorization-requests/:uuid/poll.json`

| Property | Value |
| --- | --- |
| Controller | `AuthorizationRequestController` |
| Auth | `@Public()` |
| Request body | `PollAuthorizationRequestDto` — `{ pollToken: string }` |
| Success response | `{ status }`; on the winning `approved` poll: `{ status: 'approved', user }` + sets the session cookies |
| HTTP status | `200` (default); `404` on an unknown `uuid` or a `pollToken` that doesn't hash-match |

An `open` request past its `expiresAt` is lazily flipped to `expired` on the poll that observes
it. Only the first poll to claim an `approved` request mints a session — the winning response
reuses `respondWithSession` (see "Session cookies" below), the same session shape as
login/register/refresh. Every other poll of an already-claimed request gets `{ status: 'logged'
}`, no credentials.

### `POST /auth/authorization-requests/mine.json`

| Property | Value |
| --- | --- |
| Controller | `AuthorizationRequestController` |
| Auth | Default `JwtGuard` (authenticated, no `@AdminOnly()`) |
| Request body | — |
| Success response | `{ requests: [{ uuid, requestIp, requestUserAgent, createdAt, expiresAt, keepSignedIn }] }` |
| HTTP status | `200` (default) |

Lists the caller's own `open`, non-expired authorization requests, newest first. The caller's id
comes from `req.user.sub`, populated by `JwtGuard`.

### `POST /auth/authorization-requests/:uuid/authorize.json`

| Property | Value |
| --- | --- |
| Controller | `AuthorizationRequestController` |
| Auth | Default `JwtGuard` (authenticated, no `@AdminOnly()`) |
| Request body | `AuthorizeAuthorizationRequestDto` — `{ password: string }` |
| Success response | `{ authorized: true }` |
| HTTP status | `200` (default); `400 Bad Request` on any business rejection |

Re-verifies the caller's own current password before approving a request raised against their
own username. Every business rejection — missing row, wrong owner, wrong status, expired, wrong
password, or locked out by the cool-off guard — collapses into the same `400`, never `401`/`403`,
so `ApiClient`'s refresh-and-retry logic is never triggered by a business rejection.

### `POST /auth/authorization-requests/:uuid/deny.json`

| Property | Value |
| --- | --- |
| Controller | `AuthorizationRequestController` |
| Auth | Default `JwtGuard` (authenticated, no `@AdminOnly()`) |
| Request body | — |
| Success response | `{ denied: true }` |
| HTTP status | `200` (default); `400 Bad Request` on any business rejection |

Same ownership/status rejection shape as `authorize`, but no password is required.

### Sessions

A *session* is one chain of rotated refresh tokens: every token minted on login (password,
device-authorization or register) gets a fresh `session_uuid` and `started_at`, and every
`POST /auth/refresh.json` copies both onto the replacement token. Since rotation revokes the
presented token, an active session is exactly one non-revoked, unexpired `auth_refresh_tokens`
row. The *current* session is the one whose refresh token matches the `refresh_token` cookie
(the same convention as `logoff`/`status`). The session routes take no request body; the cookie
reaches them because they live under its `Path=/auth`. No user agent or IP is captured or shown.

### `POST /auth/sessions/mine.json`

| Property | Value |
| --- | --- |
| Controller | `SessionController` |
| Auth | Default `JwtGuard` (authenticated, no `@AdminOnly()`) |
| Request | `refresh_token` cookie (no body) |
| Success response | `{ sessions: [{ id, startedAt, lastUsedAt, keepSignedIn, current }] }` |
| HTTP status | `201` (Nest's `POST` default) |

Lists the caller's own active (non-revoked, unexpired) sessions, most recently used first. `id`
is the session UUID; `startedAt` is the login time; `lastUsedAt` is the active token's
`issuedAt` (the latest login or rotation); `current` is `true` for the session matching
the cookie. A missing, unknown, revoked, expired or foreign token is not an error: the list
is still returned, with no entry marked `current`.

### `POST /auth/sessions/:uuid/revoke.json`

| Property | Value |
| --- | --- |
| Controller | `SessionController` |
| Auth | Default `JwtGuard` (authenticated, no `@AdminOnly()`) |
| Request body | None expected (any body is ignored) |
| Success response | `{ revoked: true }` |
| HTTP status | `201`; `400 Bad Request` for a malformed `:uuid`; `404 Not Found` for an unknown, already-revoked or another user's session |

Revokes one of the caller's sessions (its unrevoked token, `revokedReason` `user_revoked`).
`:uuid` is validated by `ParseUUIDPipe` accepting any UUID version (sessions backfilled by the
migration carry MySQL `UUID()` v1 IDs); a malformed value answers `400`. An unknown session and
another user's session both answer the same `404`, so existence never leaks. Revoking the
current session is allowed and behaves like a logoff (the access-token cookie is left alone and
expires on its own; the client's next refresh gets `401`, which clears the session cookies). The revoked session's later
refresh attempts get a plain `401` without triggering replay detection.

**Revocation stops the refresh token only.** Access tokens are stateless JWTs not tracked
server-side, so a revoked session's already-issued access token stays valid until it expires —
`KERGHAN_ACCESS_TOKEN_TTL_MS`, 15 minutes by default. This applies to both session-revoke
routes.

### `POST /auth/sessions/revoke-others.json`

| Property | Value |
| --- | --- |
| Controller | `SessionController` |
| Auth | Default `JwtGuard` (authenticated, no `@AdminOnly()`) |
| Request | `refresh_token` cookie (no body) |
| Success response | `{ revoked: true }` |
| HTTP status | `201`; `401 Unauthorized` when the cookie is missing or its token is invalid |

Revokes every session of the caller except the current one (`revokedReason` `user_revoked`).
The current session is kept by its `sessionUuid` (resolved from the cookie's token), not by the
token's hash, so a concurrent rotation of the current session is never revoked by mistake.
When the cookie is missing or its token is unknown, revoked, expired or another user's, it answers `401` and
revokes nothing — it never falls back to revoking every session. The revoked sessions' later
refresh attempts get a plain `401` without triggering replay detection.

Note for the frontend: a `401` here can trigger `ApiClient`'s refresh-and-retry. That is
intentional: it only happens when the client's refresh-token cookie is already invalid, so the
refresh fails too and the client logs out (unlike `authorize.json`, which uses `400` for its
business rejections precisely to avoid that path).

## Shared behavior

All thirteen routes above (the five classic ones, the five device-authorization ones and the
three session ones) are
declared `@CachePolicy(CacheClass.Never)` at controller level, so they send
`X-Skip-Cache: true` and `Cache-Control: no-store` on the response. Tent's
`default_proxy` rule caches any 2xx `*.json` response keyed only by query
string, regardless of HTTP method — since these POST routes carry no
query string, an uncapped response could otherwise be cached after the
first login/register/refresh/authorization-request call and served verbatim (credentials
included) to a different caller.

See [API Caching](../../architecture/caching.md) for the general strategy.

## Session cookies

Every session-minting response (login, register, refresh and the winning
`POST /auth/authorization-requests/:uuid/poll.json`) goes through the shared `respondWithSession`
helper (`auth/auth-response.ts`), which calls `setSessionCookies` (`auth/auth-cookies.ts`), so
the response bodies/cookies cannot drift apart. All three cookies are `Secure` and
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
`refresh.json` and on a `status.json` answering `loggedIn: false`.

## Source files

| File | Role |
| --- | --- |
| `auth/auth.controller.ts` | Route definitions, cookie/header setup |
| `auth/auth.service.ts` | Business logic (login, register, refresh, logout) |
| `auth/dto/login.dto.ts` | `LoginDto` validation |
| `auth/dto/register.dto.ts` | `RegisterDto` validation |
| `auth/auth-cookies.ts` | Session cookie constants and set/clear/read helpers |
| `auth/dto/refresh-fallback.dto.ts` | `RefreshFallbackDto` — temporary body fallback for `refresh.json` (`TODO(#324-migration)`) |
| `auth/authorization-request.controller.ts` | Device-authorization route definitions, cookie/header setup |
| `auth/authorization-request.service.ts` | Device-authorization business logic (create, poll, listOpenForUser, authorize, deny) |
| `auth/authorization-request-abuse-guard.service.ts` | Rate-limit/cap/cool-off hardening logic |
| `auth/entities/authorization-request.entity.ts` | `AuthorizationRequest` entity (`auth_authorization_requests`) |
| `auth/dto/create-authorization-request.dto.ts` | `CreateAuthorizationRequestDto` validation |
| `auth/dto/poll-authorization-request.dto.ts` | `PollAuthorizationRequestDto` validation |
| `auth/dto/authorize-authorization-request.dto.ts` | `AuthorizeAuthorizationRequestDto` validation |
| `auth/session.controller.ts` | Session-management route definitions |
| `auth/session.service.ts` | Session business logic (listActive, revoke, revokeOthers) |
