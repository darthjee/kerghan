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
| `POST /auth/login.json` | `{ username, password }` | `{ user, refreshToken }` + `access_token` cookie |
| `POST /auth/register.json` | `{ username, email, password }` | `{ user, refreshToken }` + `access_token` cookie |
| `POST /auth/refresh.json` | `{ refreshToken }` | `{ user, refreshToken }` + `access_token` cookie |
| `DELETE /auth/logoff.json` | `{ refreshToken }` | `204 No Content`, clears the `access_token` cookie |

`user` is always `{ id, username, email }` — `passwordDigest` is never serialized.

All four routes also set `X-Skip-Cache: true` on the response. Tent's `default_proxy` rule
caches any 2xx `*.json` response keyed only by query string, regardless of HTTP method — since
these POST routes carry no query string, an uncapped response could otherwise be cached after
the first login/register/refresh and served verbatim (credentials/session token included) to a
different caller. See `docs/agents/architecture/proxy.md`'s "Cache bypass (`X-Skip-Cache`)"
section for the general convention.

## Entities (`auth_` table prefix)

- `auth_users` (`entities/user.entity.ts`) — `id`, `username` (unique), `email` (unique),
  `passwordDigest`, `createdAt`, `updatedAt`.
- `auth_refresh_tokens` (`entities/refresh-token.entity.ts`) — `id`, `tokenHash` (SHA-256 of the
  token, unique — the plaintext value is returned to the client once and never stored),
  `userId` (logical FK), `issuedAt`, `expiresAt`, `revokedAt`.
- `auth_sessions` (`entities/session.entity.ts`) — `id`, `userId` (logical FK), `createdAt`,
  `lastSeenAt`. Bookkeeping only (touched on every token issuance) — not itself an
  authorization gate; see "JWT/refresh-token flow" below for what actually invalidates access.

A dev/manual-testing demo user (`demo`/`kerghan-demo`) is seeded by
`database/migrations/20260824120004-auth-seed-demo-user.ts`, gated on `process.env.STAGE !==
'production'` so it can never be created if `yarn migration:run` is ever pointed at a production
database. The password comes from `KERGHAN_DEMO_PASSWORD` (see
`docs/agents/environment-variables.md`), set to `kerghan-demo` in `.env.dev.sample` — if that
var is unset the migration falls back to `kerghan-demo-placeholder`, which is **not** a working
login for the documented demo credentials, it only exists so the real password never lives in
source.

## JWT/refresh-token flow

- **Access token**: JWT (`@nestjs/jwt`), signed with `KERGHAN_SECRET_KEY` (via `ConfigService`,
  never read directly). Expiry is configurable via `KERGHAN_ACCESS_TOKEN_TTL_MS` (milliseconds;
  defaults to `900000`, 15 minutes, when unset) — see `docs/agents/environment-variables.md`. Set
  as an `httpOnly` + `Secure` + `SameSite=Strict` cookie (`access_token`), whose `maxAge` is
  driven by the same env var — never returned in the response body.
- **Refresh token**: a random 48-byte hex string, 7 day expiry, returned in the response body
  and persisted only as a SHA-256 hash. **Rotated on every use**: `POST /auth/refresh.json`
  marks the presented token's `revokedAt` and issues a brand new pair — replaying an
  already-rotated (or logged-out) refresh token is rejected with `401`, verified end-to-end in
  `auth/tests/auth.controller.e2e-spec.ts`. Replaying a token that's specifically
  already-*revoked* (not merely expired) is treated as a compromise signal: every other
  currently-active refresh token for that user is revoked too, forcing re-login.
- **Logout**: `DELETE /auth/logoff.json` sets `revokedAt` on the matching refresh token and
  clears the `access_token` cookie. The access token itself stays valid (stateless JWT, not
  tracked server-side) until its own expiry — logout guarantees the *refresh* path is closed,
  not instant access-token revocation.
- **Registration also logs in**: `POST /auth/register.json` issues a token pair immediately on
  success, same as login/refresh (per the issue's "issued on login/register/refresh" flow) —
  there's no separate "register, then log in" round trip.

## `user.registered` event

`AuthService#register` fires `user.registered` (via `EventEmitter2`) with a
`UserRegisteredEvent { userId, username, email }` payload on every successful registration — see
`events/user-registered.event.ts`. No listener consumes it yet; it exists so a future module
(e.g. a welcome-email or onboarding module) can react without `AuthService` knowing it exists,
per the modular pattern's event-driven communication rule.

## Testing

- `auth/tests/auth.service.spec.ts` — unit specs, mocked repositories, port of the old
  `Authenticator_spec.js`/`Registrar_spec.js` coverage plus the JWT/refresh/logout behavior.
- `auth/tests/auth.controller.e2e-spec.ts` — e2e specs via `supertest` against a real
  `INestApplication` with in-memory fake repositories (see `architecture/backend.md`'s Testing
  section): login flow, refresh-token rotation (including replay/expiry rejection), logout, and
  the global `JwtGuard` (public routes, missing/invalid/valid access token) against two
  throwaway controllers defined in the spec itself.
