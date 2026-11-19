# Auth — Entities and JWT/Refresh-Token Flow

## Entities (`auth_` table prefix)

- `auth_users` (`entities/user.entity.ts`) — `id`, `username` (unique), `email` (unique),
  `passwordDigest`, `githubHandle` (`github_handle`, nullable `varchar(39)`, the optional
  [GitHub handle](github-handle.md), the only user-editable field that is not environment-
  managed for the default user; the admin routes never expose it), `isAdmin` (boolean, default
  `false`), `status` (`varchar(16)`, NOT NULL, no
  default: one of `pending`, `approved`, `denied`, the `UserStatus` constants; always set
  explicitly by the service that creates the row, so no implicit default can silently grant
  access), `createdAt`, `updatedAt`. Only `approved` users pass the session gate; transitions,
  migration backfill and seeds: [User approval → Status model](user-approval.md#status-model).
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
  [Device-authorization flow](device-authorization.md#device-authorization-flow) for the full contract.

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
     says (see [User approval](user-approval.md)).

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
  by the session lookup (see above), not after `KERGHAN_ACCESS_TOKEN_TTL_MS`. Every query is scoped to the caller's `userId`. See [Auth routes](../../backend/routes/auth/sessions-and-account.md#sessions).
- **Registration also logs in**: `POST /auth/register.json` issues a token pair immediately on
  success, same as login/refresh (per the issue's "issued on login/register/refresh" flow) —
  there's no separate "register, then log in" round trip. This holds for a `pending`
  registration too: the session exists but the gate blocks it until an admin approves (see
  [User approval](user-approval.md)).


