# Module — Auth

Kerghan's first backend module, and its only **always-on** module (imported directly into
`AppModule` — see `docs/agents/architecture/modular-pattern.md`'s classification). Owns
Kerghan's lightweight per-user login (username/password, independent of any GitHub handle — see
`docs/agents/product.md`). Ported from the pre-migration Express `Authenticator`/`Registrar`/
`UserSerializer` (`backend/lib/accounts/`, `backend/lib/serializers/`, now removed).

## Routes

See [Auth routes](../backend/routes/auth.md) for the full per-endpoint reference (request/response
detail, HTTP status, source files).

All routes are `@Public()` (exempt from the global `JwtGuard`) and end in `.json`, per Tent's
routing convention (`docs/agents/architecture/backend.md`):

| Route | Body | Response |
|---|---|---|
| `POST /auth/login.json` | `{ username, password, keepSignedIn? }` | `{ user }` + session cookies |
| `POST /auth/register.json` | `{ username, email, password }` | `{ user }` + session cookies |
| `POST /auth/refresh.json` | — (`refresh_token` cookie; temporary `{ refreshToken? }` fallback, `TODO(#324-migration)`) | `{ user }` + session cookies; `401` clears them |
| `DELETE /auth/logoff.json` | — (`refresh_token` cookie) | `204 No Content`, clears the session cookies |
| `POST /auth/status.json` | — (`refresh_token` cookie) | `{ loggedIn, isAdmin }`, plus `status: "pending"` for a [pending user](auth/user-approval.md); `loggedIn: false` clears the session cookies, except for a pending user |

The *session cookies* (all `Secure` + `SameSite=Strict`, set/cleared only through
`auth/auth-cookies.ts`) are the httpOnly `access_token` (`Path=/`, access-token TTL), the
httpOnly `refresh_token` (`Path=/auth`, expiring with the refresh-token row) and the
script-readable `logged_in=1` (`Path=/`, same expiry as `refresh_token`) that drives the
frontend's optimistic login state. No route returns or accepts the refresh token in a body,
except `refresh.json`'s migration fallback: only when the cookie is absent, it reads an optional
body `refreshToken` so a client can move a legacy `localStorage` token into the cookie once. The
cookie always wins. Remove the fallback (`RefreshFallbackDto` and the marked branch in
`resolveRefreshToken`) once the migration window closes. See
[Auth routes](../backend/routes/auth.md#session-cookies).

`user` is always `{ id, username, email, isAdmin }` — `passwordDigest` is never serialized. `isAdmin`
is the only way the frontend can learn whether the logged-in user is an admin, since the
`access_token` cookie is `httpOnly`. `/auth/status.json`'s `isAdmin` is resolved from the token
row's user when `loggedIn` is `true`, and is always `false` when `loggedIn` is `false`. When
automatic login is on, `status.json` can also log a caller with no valid session in as the
default user; see [Default user](#default-user).

### Admin tool routes (`AdminController`, `/admin` prefix)

Every route below requires the default `JwtGuard` behavior (no `@Public()`) plus `@AdminOnly()`
(applied once at the controller level) — see "Admin authorization" below for what that enforces.
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
[User approval → Admin review](auth/user-approval.md#admin-review). The other two
routes both mint a fresh `PasswordResetToken` via `PasswordResetService#issueToken` (shared with
self-service `recover()`) for the given `:id`, never invalidating that user's other outstanding
tokens, and `404`s when `:id` doesn't match an account. `send-recovery-email.json` additionally
calls `MailService.sendEmailTemplate(...)` directly and synchronously (not the fire-and-forget
`password-recovery.requested` event self-service uses), so the admin gets a real
`sent: true`/`false` result instead of a always-`true` response — `sent: false` covers both a
disabled mail transport and a thrown send error, never a `500`.

While the [default user](#default-user) feature is enabled, `POST /admin/users/:id/edit.json`
(`AdminService#editUser`), `recovery-link.json` and `send-recovery-email.json` answer
`409 DEFAULT_USER_MANAGED` when `:id` is the default user (after the usual `404` for an unknown
id), and change nothing. See
[Edit blocking](auth/default-user.md#edit-blocking).

All six admin routes are `@CachePolicy(CacheClass.Never)` (controller level), so they send
`X-Skip-Cache: true` and `Cache-Control: no-store` on the response. Tent's `default_proxy` rule
caches any 2xx `*.json` response keyed only by query string, regardless of HTTP method — since
these POST routes carry no query string, an uncapped response could otherwise be cached after
the first login/register/refresh and served verbatim (credentials/session token included) to a
different caller. See [API Caching](../architecture/caching.md) for the general strategy.

## CSRF protection

Every mutating route above (`POST`/`PATCH`/`DELETE`), `@Public()` or not, is covered by the
global `OriginGuard` (`core/origin.guard.ts`), which runs before `JwtGuard` and rejects
cross-site requests with `403` based on `Sec-Fetch-Site`/`Origin`. Together with the
`SameSite=Strict` session cookies, this also blocks login CSRF on the unauthenticated
routes (`login.json`, `register.json`, `recover.json`, `reset-password.json`, `refresh.json`,
`status.json`, the device-authorization `create`/`poll`). See
[`docs/agents/architecture/security.md`](../architecture/security.md#csrf) for the full decision
table, the accepted residual risks and the rules future changes must keep.

## Entities (`auth_` table prefix)

- `auth_users` (`entities/user.entity.ts`) — `id`, `username` (unique), `email` (unique),
  `passwordDigest`, `isAdmin` (boolean, default `false`), `status` (`varchar(16)`, NOT NULL, no
  default: one of `pending`, `approved`, `denied`, the `UserStatus` constants; always set
  explicitly by the service that creates the row, so no implicit default can silently grant
  access), `createdAt`, `updatedAt`. Only `approved` users pass the session gate; transitions,
  migration backfill and seeds: [User approval → Status model](auth/user-approval.md#status-model).
- `auth_refresh_tokens` (`entities/refresh-token.entity.ts`) — `id`, `tokenHash` (SHA-256 of the
  token, unique — the plaintext value is returned to the client once and never stored),
  `userId` (logical FK), `issuedAt`, `expiresAt`, `revokedAt`, `revokedReason` (`revoked_reason`,
  nullable `varchar(32)` — why the token was revoked, `NULL` while unrevoked; see "Revocation
  reasons" below), `keepSignedIn` (`keep_signed_in`,
  boolean, default `false` — whether the token is a persistent "keep me signed in" one),
  `sessionUuid` (`session_uuid`, `varchar(36)`, non-unique index) and `startedAt` (`started_at`)
  — the session identity: a fresh UUID and the login time are minted by
  `TokenService#issueTokens` on every new login (password, device-authorization, register) and
  copied onto the replacement token on every rotation, the same way `keepSignedIn` is. So one
  session is one chain of rotated tokens, with at most one unrevoked row at a time. Rows that
  predate the column were backfilled as one session each, with `started_at = issued_at`
  (`database/migrations/20261005120017-auth-add-refresh-tokens-session.ts`).
  **Pruning:** every mint (`TokenService#issueTokens` — login, register, device authorization,
  rotation) first deletes that user's rows whose `expiresAt` is already past. Revoked but
  unexpired rows are kept: replay detection needs them, and since
  `AuthService#findActiveRefreshToken` rejects an expired token before it checks
  `revokedAt`/`revokedReason`, deleting expired rows cannot weaken it. There is no scheduler and
  no retention window, so an inactive user's expired rows stay until that user's next mint.
- `auth_password_reset_tokens` (`entities/password-reset-token.entity.ts`) — `id`, `tokenHash`
  (SHA-256, unique), `userId` (logical FK), `expiresAt`, `createdAt`, `usedAt` (set once the
  token is consumed). **Pruning:** every mint (`PasswordResetService#issueToken` — self-service
  recover and the admin recovery-link/email routes) first deletes that user's rows that are
  expired or already used; their still-active tokens stay valid.
- `auth_authorization_requests` (`entities/authorization-request.entity.ts`) — see
  "Device-authorization flow" below for the full contract.

A dev/manual-testing demo user (`demo`/`kerghan-demo`) is seeded by
`database/migrations/20260824120004-auth-seed-demo-user.ts`, gated on `process.env.STAGE !==
'production'` so it can never be created if `yarn migration:run` is ever pointed at a production
database. The password comes from `KERGHAN_DEMO_PASSWORD` (see
`docs/agents/environment-variables.md`), set to `kerghan-demo` in `.env.dev.sample` — if that
var is unset the migration falls back to `kerghan-demo-placeholder`, which is **not** a working
login for the documented demo credentials, it only exists so the real password never lives in
source. A follow-on dev-only migration
(`database/migrations/20260903120007-auth-promote-demo-user-admin.ts`), also gated on
`process.env.STAGE === 'production'`, promotes the seeded `demo` user to admin so admin-only
tooling stays exercisable out of the box locally — it has to be a separate, later migration
rather than an edit to the seed migration's `INSERT`, since the seed migration runs before
`is_admin` exists on a fresh database.

## JWT/refresh-token flow

- **Access token**: JWT (`@nestjs/jwt`), signed with `KERGHAN_SECRET_KEY` (via `ConfigService`,
  never read directly). `JwtGuard` verifies against the current key first, then each retired
  key in `KERGHAN_PREVIOUS_SECRET_KEYS` (resolved by `core/secret-keys.ts`), so the key can be
  rotated without logging users out — see the rotation runbook in
  `docs/agents/environment-variables.md`. Expiry is configurable via `KERGHAN_ACCESS_TOKEN_TTL_MS` (milliseconds;
  defaults to `900000`, 15 minutes, when unset) — see `docs/agents/environment-variables.md`. Set
  as an `httpOnly` + `Secure` + `SameSite=Strict` cookie (`access_token`), whose `maxAge` is
  driven by the same env var — never returned in the response body. The payload
  (`core/access-token-payload.ts`'s `AccessTokenPayload`) carries `sub` (the user id), `sid`,
  `username` and `isAdmin`. **`sid`** is the `sessionUuid` of the refresh-token session the
  token was minted for (see "Sessions" below). Every path that mints an access token sets it:
  login, register, refresh, the winning device-authorization poll and the automatic login on
  `status.json`. `username` and `isAdmin` are still signed into the token, but they are not
  trusted for authorization: `request.user` comes from the database (see "Session lookup"
  below).
- **Session lookup (`JwtGuard`)**: on every request that is not `@Public()`, after the
  signature and expiry check, `JwtGuard` (`core/jwt.guard.ts`) validates the claims and looks
  the session up through Core's `SESSION_LOOKUP` token, which the Auth module implements with
  `SessionService#findActiveSessionUser`. It allows the request only when:
  1. an **active** (not revoked, not expired) refresh-token row has `session_uuid = sid`;
  2. that row's `userId` equals `sub`;
  3. the user's status is `approved` — **always**, whatever `KERGHAN_USER_APPROVAL_REQUIRED`
     says (see [User approval](auth/user-approval.md)).

  **Claim validation** runs before the query: unless `sid` is a string holding a well-formed
  UUID and `sub` is an integer, the token is invalid. A non-string claim never reaches the
  query. The lookup is **one indexed query** per authenticated request (`session_uuid` is
  indexed), an in-module join of `auth_refresh_tokens` to `auth_users`. A database error
  propagates (`500`). Rotation keeps the session valid: `refresh.json` copies `session_uuid`
  onto the replacement token, so the `sid` keeps matching.

  **Same `401` for every rejection.** No row, a `userId` mismatch, a non-approved user, and a
  missing or malformed `sid` all throw the same `UnauthorizedException`
  (`Invalid or expired access token`) as a bad signature or an expired token, with no
  status-specific code. **Why:** a rejection must not be told apart from an invalid or expired
  token, so the gate never reveals that an account is pending or denied, or that a session was
  revoked. (A request with no `access_token` cookie at all still gets the different
  `Missing access token` message.)

  **`request.user` from the database.** After the lookup, `JwtGuard` sets `request.user` to
  `{ sub, sid, username, isAdmin }` built from the **joined user row**, not from the JWT claims,
  with no extra query. `AdminGuard` and `@CurrentUser()` are unchanged and always see current
  values.

  **Tokens without `sid` get `401`**, with no legacy path. This logs no one out: the session is
  the refresh-token row, which a deploy does not touch. On a `401`, the frontend's `ApiClient`
  refreshes (`POST /auth/refresh.json`) and retries the request once, and the refresh mints a
  `sid`-bearing token for the same session. Device-authorization sessions use the same cookies
  and refresh flow. Only a client that never refreshes on `401` sees a single `401` after such
  a deploy. **Rejected alternative:** accepting `sid`-less tokens with a user-id-only lookup
  until they expire. It would be a temporary second path to remove later, and it would let
  those tokens skip the session-revocation check for up to one access-token TTL, for no
  user-visible benefit.

  **Immediate effects.** Because the gate checks the session and the user on every request,
  these apply on the **next request**, not after the access-token TTL: an admin deny, logout,
  a session revoke, revoke-others, the password-change revocations, an admin demotion (today
  through the default-user boot sync driven by `KERGHAN_DEFAULT_USER_ADMIN`, or a manual DB
  change) and a username change.
- **Refresh token**: a random 48-byte hex string, set as the httpOnly `refresh_token` cookie
  (`Path=/auth`, `maxAge` = the row's `expiresAt - now`, exposed by `TokenService#issueTokens`
  as `AuthResult.refreshTokenExpiresAt`) — never returned in a response body — and persisted
  only as a SHA-256 hash. Its expiry depends on the session's `keepSignedIn` choice (optional
  strict boolean on `POST /auth/login.json` and `POST /auth/authorization-requests.json`,
  default `false`; register always mints a regular token): regular tokens use
  `KERGHAN_REFRESH_TOKEN_TTL_MS` (default 7 days), `keepSignedIn` tokens use
  `KERGHAN_PERSISTENT_REFRESH_TOKEN_TTL_MS` (default 30 days). Both are read on every mint (see
  `docs/agents/environment-variables.md`). Rotation carries the presented token's `keepSignedIn`
  over to the new one with a fresh TTL, so an active persistent session renews indefinitely (no
  absolute cap); a regular session cannot be upgraded in place. Since #324 the token never
  reaches JavaScript (httpOnly cookie), so an XSS can no longer exfiltrate it. **Rotated on every use**: `POST /auth/refresh.json`
  marks the presented token's `revokedAt` (reason `rotated`) and issues a brand new pair —
  replaying an already-rotated (or logged-out) refresh token is rejected with `401`, verified
  end-to-end in `auth/tests/auth.controller.refresh-logout.e2e-spec.ts`. Only replaying an
  *unexpired* token revoked **by rotation** is treated as a compromise signal: every
  currently-active refresh token for that user is revoked too (reason `replay_detected`),
  forcing re-login. Expiry is checked first, and a token revoked for any other reason gets a
  plain `401` with no side effects, so an intentionally revoked device (or an attacker holding
  its stolen token) can't force-logout the user's other sessions. The replay response still
  revokes every token of the user, not just the replayed session's chain. The rotation write is
  conditional (`UPDATE ... WHERE id = ? AND revoked_at IS NULL`): if a concurrent logout,
  session revoke, password change or second refresh revoked the token after it was read, the
  update affects no row and the refresh answers a plain `401` without issuing tokens, so the
  other revocation's reason is never overwritten and two racing refreshes can't both succeed.
- **Revocation reasons** (`RevokedReason` in `entities/refresh-token.entity.ts`), set by every
  revocation path: `rotated` (`AuthService#refresh`), `logout` (`AuthService#logout`),
  `user_revoked` (`SessionService#revoke`/`#revokeOthers`), `password_change` (My Account),
  `password_reset` (recovery reset), `admin_password_change` (`AdminService#editUser`),
  `replay_detected` (the replay response above) and `admin_denied` (`AdminService#denyUser`
  for every active token of the user, and `refresh.json` / `status.json` for a denied user's
  token that is still active, e.g. one minted by a rotation racing the deny). Only `rotated`
  triggers replay detection, so `admin_denied` never does.
  `TokenService#revokeUserTokens(userId, reason, keepRefreshToken?)` takes the reason
  explicitly. Rows already revoked when the column was added were backfilled as `rotated`
  (`database/migrations/20261005120018-auth-add-refresh-tokens-revoked-reason.ts`): rotation
  and logout can't be told apart retroactively, so this keeps the replay detection they had
  before, bounded by their (now first-checked) expiry. Deploy-time trade-off: a token logged
  out (or otherwise revoked) before this migration is indistinguishable from a rotated one, so
  presenting it still triggers replay detection (revoking all of the user's sessions) until it
  expires — up to 7 days after issue, or 30 for keep-signed-in tokens (the default TTLs). A
  revoked row with a `NULL` reason is treated like any non-rotation revocation (plain `401`).
- **Logout**: `DELETE /auth/logoff.json` sets `revokedAt` (reason `logout`) on the matching
  refresh token — only if it is still unrevoked, so logging out with an already-rotated token
  never overwrites its `rotated` reason — and clears all three session cookies. It reads the
  token from the `refresh_token` cookie and answers `204` even without one. Once the session is
  revoked, its access token is refused by the session lookup on the next request, even if it
  has not expired yet.
- **Password change**: every successful password change revokes refresh tokens through
  `TokenService#revokeUserTokens`:
  - A password-recovery reset (`POST /auth/reset-password.json`) revokes all of the user's
    refresh tokens.
  - A My Account password change (`PATCH /auth/account.json` with `newPassword`) revokes all
    of the caller's *other* tokens, keeping the session identified by the `refresh_token`
    cookie (the body no longer carries a `refreshToken`). The
    presented token is kept only if it is one of the caller's own active tokens. When it is
    missing, unknown, revoked or belongs to someone else, all of the caller's tokens are revoked
    (fail safe). Username/email-only changes and failed attempts revoke nothing.
  - An admin password edit (`AdminService#editUser` with `newPassword`) revokes all of the target
    user's tokens, including the admin's own when they edit their own account.
  - As with logout, the access tokens of every revoked session are refused on their next
    request; the kept session's access token keeps working.
- **Sessions**: `SessionService` (`session.service.ts`) and the thin `SessionController`
  (`session.controller.ts`, default `JwtGuard`, `@CachePolicy(CacheClass.Never)`) let a user
  list their active sessions (`POST /auth/sessions/mine.json`), revoke one by its
  `sessionUuid` (`POST /auth/sessions/:uuid/revoke.json`, `404` for an unknown or foreign id)
  or revoke every session but the current one (`POST /auth/sessions/revoke-others.json`, `401`
  and nothing revoked when the `refresh_token` cookie is missing or not one of the caller's
  active tokens; every session route reads the current session from that cookie, with no body; the current session is kept by `sessionUuid`, not token hash, so a concurrent
  rotation isn't revoked). `:uuid` is validated with `ParseUUIDPipe` (any version; `400` when
  malformed). Revoked tokens get reason `user_revoked`, so their later refresh is a plain `401`
  without replay detection. A revoked session's access token is refused on its next request
  by the session lookup (see above), not after `KERGHAN_ACCESS_TOKEN_TTL_MS`. Every query is scoped to the caller's `userId`. See [Auth routes](../backend/routes/auth.md#sessions).
- **Registration also logs in**: `POST /auth/register.json` issues a token pair immediately on
  success, same as login/refresh (per the issue's "issued on login/register/refresh" flow) —
  there's no separate "register, then log in" round trip. This holds for a `pending`
  registration too: the session exists but the gate blocks it until an admin approves (see
  [User approval](auth/user-approval.md)).

## Device-authorization flow

A second way to log in, alongside the JWT/refresh-token flow above: a not-yet-logged-in device
(the "requester") asks an already-logged-in device (the "approver", same account) to vouch for a
username, then polls until that device approves or denies it. The frontend's login modal
(`LoginModal`) is the single entry point for this — standalone login/register pages no longer
exist; the requester picks the "authorize with a logged-in device" mode instead of typing a
password — see `docs/agents/architecture/frontend.md`'s "Auth flow" section for the frontend side.

### Entity

`auth_authorization_requests` (`entities/authorization-request.entity.ts`), owned by this module:
`uuid` (unique, public identifier), `username` (as typed by the requester), `userId` (logical FK
into `auth_users`, `NULL` when `username` didn't resolve to a real user — such a row can never be
approved), `status` (the state machine below), `pollTokenHash` (unique, SHA-256 of the poll
token), `requestIp`/`requestUserAgent` (captured at creation), `approvedByUserId`, `createdAt`/
`expiresAt`/`resolvedAt`/`loggedAt`, and the hardening columns `authorizeFailedAttempts`/
`authorizeLockedUntil` (see "Hardening limits" below), and `keepSignedIn` (`keep_signed_in`,
boolean, default `false` — the requesting device's "keep me signed in" choice, applied to the
token minted by the winning poll; the approver sees it but cannot change it).

### Device-authorization routes

Same compact-table convention as "Routes" above — see [Auth routes](../backend/routes/auth.md)
for the full per-endpoint reference. Unlike the four classic routes, only `create`/`poll` are
`@Public()`; `mine`/`authorize`/`deny` require the default `JwtGuard` (the first non-admin
authenticated routes in the codebase), with the caller's own user id read from `req.user.sub`.

| Route | Auth | Body | Response |
|---|---|---|---|
| `POST /auth/authorization-requests.json` | `@Public()` | `{ username, keepSignedIn? }` | `{ uuid, pollToken, expiresAt }` |
| `POST /auth/authorization-requests/:uuid/poll.json` | `@Public()` | `{ pollToken }` | `{ status }`, plus `user` + the session cookies on the winning `approved` poll |
| `POST /auth/authorization-requests/mine.json` | `JwtGuard` | — | `{ requests: [{ uuid, requestIp, requestUserAgent, createdAt, expiresAt, keepSignedIn }] }` |
| `POST /auth/authorization-requests/:uuid/authorize.json` | `JwtGuard` | `{ password }` | `{ authorized: true }` |
| `POST /auth/authorization-requests/:uuid/deny.json` | `JwtGuard` | — | `{ denied: true }` |

`authorize`/`deny` collapse every business rejection (missing row, wrong owner, wrong status,
expired, wrong password, locked out) into the same `400 Bad Request` — never `401`/`403` — so
`ApiClient`'s refresh-and-retry logic is never triggered by a business rejection, only by an
actually-expired session.

### Status machine

`open → approved → logged` is the success path: `authorize` moves a request to `approved`, and
the winning poll claims it atomically (a guarded `UPDATE ... WHERE status = 'approved'`, so only
the first poll to observe `approved` can flip it to `logged` and mint a session — every other,
losing poll — including the requester's own next tick after that — gets back `{ status: 'logged'
}` with no credentials). `open → denied` covers an explicit `deny`. `open → expired` covers lazy
expiry (an `open` poll past its `expiresAt`) and the abuse-guard's open-cap eviction (see
"Hardening limits" below) — both flip an `open` row straight to `expired` without ever visiting
`approved`.

`logged → denied` covers a user who is no longer `approved` when the session would be minted
(e.g. denied by an admin between `authorize` and `poll`, or between the claim and the mint).
After the claim, the winning poll loads the user row and re-checks its status right before
minting (`AuthorizationRequestService#issueSessionFor`). A non-approved user never gets a
session: a conditional `UPDATE ... WHERE status = 'logged'` flips the request to `denied` and
the poll answers `{ status: "denied" }`, with no `user` and no cookies. A deny that lands after
the tokens were minted is covered by the deny's revocation and the session lookup.
`authorize.json` itself needs no status check: it is authenticated, so the gate answers a
non-approved caller with `401` before the endpoint runs.

### Poll-token contract

Mirrors refresh-token hashing: `create` mints a random poll token, returns it once in the
response body, and persists only its SHA-256 hash (`pollTokenHash`). A poll with an unknown
`uuid` or a `pollToken` that doesn't hash-match is indistinguishable — both `404`.

### Enumeration safety

`create` always responds with the same `{ uuid, pollToken, expiresAt }` shape and does the same
work regardless of whether `username` resolves to a real user — a non-matching username still
gets a `uuid`/`pollToken` back (backed by no persisted row when the caller is over the rate
limit, or a row with `userId: null` otherwise, which can never be approved). The abuse guard's
`isOverCreateLimit` reinforces this: it always computes both the per-IP and per-username counts
via `Promise.all`, never short-circuiting on whichever resolves first, so a caller can't binary-
search which count tripped the limit by observing response timing.

### Hardening limits (`AuthorizationRequestAbuseGuardService`)

Split out of `AuthorizationRequestService` to keep the core state machine focused — not exported
from `AuthModule`, an internal collaborator only. Exact defaults/env vars are catalogued in
`docs/agents/environment-variables.md`:

- **`create` rate limit** — per-IP and per-username request counts within a sliding window; over
  either limit, `create` still returns a normal-shaped response but persists no row and fires no
  event.
- **Concurrent-open cap** — a resolved user's simultaneous `open` requests are capped; hitting the
  cap evicts (expires) the oldest open request rather than rejecting the new `create`.
- **`authorize` cool-off lockout** — consecutive wrong-password `authorize` attempts, tracked per
  request row, trip a timed lockout once a threshold is reached. A locked-out attempt still runs
  the password compare (against a dummy bcrypt digest when the approver row itself is missing), so
  it stays timing-equivalent to a normal attempt.

## Admin authorization

Routes (or whole controllers) requiring an admin account are annotated `@AdminOnly()`
(`core/admin-only.decorator.ts`), enforced by the global `AdminGuard` (`core/admin.guard.ts`),
registered as an `APP_GUARD` right after `JwtGuard`. `AdminGuard` never re-verifies the JWT — it
just reads `isAdmin` off `request.user`, which `JwtGuard` builds from the session's user row in
the database (not from the signed claim), so a demotion applies on the next request. Routes
without `@AdminOnly()` metadata are unaffected. An unauthenticated request already gets `401`
from `JwtGuard`; `@AdminOnly()` plus an authenticated non-admin gets `403` from `AdminGuard`.
`@AdminOnly()` and `@Public()` on the same route are contradictory — `@Public()` skips `JwtGuard`,
leaving `request.user` unset, which `AdminGuard` treats as forbidden.

`isAdmin` is exposed on the `user` object returned by `login`/`register`/`refresh`, and on
`/auth/status.json`'s response — see "Routes" above — so the frontend can gate admin-only UI
(e.g. #41's user-lookup/recovery-link tool, `AdminController`) without decoding the `httpOnly`
access-token cookie itself.

**First admin**: there is no admin-provisioning endpoint or CLI. Promote an account manually,
directly against the database:

```sql
UPDATE auth_users SET is_admin = true WHERE username = '<username>';
```

## Default user

An optional, environment-configured default user (`KERGHAN_DEFAULT_USER_*`, read only by
`DefaultUserConfig`): created or synchronized at boot by `DefaultUserService`, with its managed
fields (username, email, password, admin flag) blocked from API edits (`409
DEFAULT_USER_MANAGED`), and an optional automatic login in `POST /auth/status.json` for allowed
client IPs. Off by default; aimed at the standalone distribution. Product decision: #366.

Full definition, including the security warnings (admin access, IP allowlist, production guard):
[Default user and automatic login](auth/default-user.md).

## User approval

Every user has a `status` (`pending`, `approved` or `denied`), and only `approved` users pass
the session gate. The optional `KERGHAN_USER_APPROVAL_REQUIRED` flag (off by default) makes new
registrations start `pending` until an admin approves them; admins can always approve pending
users and deny any account, and `denied` is final. Product decision: #389.

Full definition, including the status-aware auth endpoints, non-disclosure rules, admin review
and the frontend: [User approval](auth/user-approval.md).

## `user.registered` event

`AuthService#register` fires `user.registered` (via `EventEmitter2`) with a
`UserRegisteredEvent { userId, username, email }` payload on every successful registration — see
`events/user-registered.event.ts`. No listener consumes it yet; it exists so a future module
(e.g. a welcome-email or onboarding module) can react without `AuthService` knowing it exists,
per the modular pattern's event-driven communication rule.

## `password-recovery.requested` event

`PasswordResetService#recover` fires `password-recovery.requested` (via `EventEmitter2`) with a
`PasswordRecoveryRequestedEvent { userId, token, resetUrl, email }` payload whenever a recovery
is requested for a known email — see `events/password-recovery-requested.event.ts`. It is
consumed in-module by `events/password-recovery-requested.listener.ts`, which renders the
`password-recovery` mail template and sends it through `MailService.sendEmailTemplate` (Mail
module, direct DI — `AuthModule` imports `MailModule`). Delivery is best-effort: the listener
swallows every send error (one `warn` line, `userId` only) and treats
a disabled-mail `{ status: 'skipped' }` as success, so a mail problem never affects the
already-responded `/auth/recover.json` request.

## Testing

- `auth/tests/auth.service.spec.ts` — unit specs, mocked repositories, port of the old
  `Authenticator_spec.js`/`Registrar_spec.js` coverage plus the JWT/refresh/logout behavior.
- `auth/tests/auth.controller.e2e-spec.ts` — e2e specs via `supertest` against a real
  `INestApplication` with in-memory fake repositories (see `architecture/backend.md`'s Testing
  section): login flow, refresh-token rotation (including replay/expiry rejection), logout, and
  the global `JwtGuard` (public routes, missing/invalid/valid access token) against two
  throwaway controllers defined in the spec itself.
- `auth/tests/admin.service.spec.ts` — unit specs, mocked repositories: `searchUsers`
  with/without a query, `generateRecoveryLink`/`sendRecoveryEmail` user-found/not-found paths,
  and the mail `sent`/`skipped`/throwing outcomes for `sendRecoveryEmail`.
- `auth/tests/support/in-memory-repo.ts` — the single shared in-memory fake TypeORM repository
  (`createInMemoryRepo`/`matchesCondition`), re-exported by
  `auth/tests/auth.controller.e2e-test-support.ts` and
  `auth/tests/authorization-request.controller.e2e-test-support.ts`.
- `auth/tests/admin.controller.e2e-spec.ts` — e2e specs, built via the shared `buildTestApp({
  adminGuard: true, registerDefaultUser: false })` from `auth.controller.e2e-test-support.ts`,
  plus the global `JwtGuard`/`AdminGuard` pair registered as `APP_GUARD`s: unauthenticated (`401`)
  and authenticated-non-admin (`403`) rejection on every admin route, an admin caller's documented
  response shapes, `404` for an unknown user id, and `X-Skip-Cache: true` on every response.
- `core/tests/jwt.guard.spec.ts` (unit) and `auth/tests/auth.controller.session-gate.e2e-spec.ts`
  (e2e) — the session lookup: active session of `sub`, revoked/expired/unknown/foreign sessions,
  missing or malformed `sid` and `sub`, rotation, `request.user` from the DB (demotion, username
  change), immediate revocation after logoff and session revoke, and rule 3 (pending and denied
  users blocked, a pending session let through once approved).
- Default user and automatic login: see
  [Default user → Testing](auth/default-user.md#testing).
- User approval: see [User approval → Testing](auth/user-approval.md#testing).
