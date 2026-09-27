# Issue: Support KERGHAN_SECRET_KEY rotation without downtime

## Description
JWT refresh-token rotation exists, but there is no strategy for rotating `KERGHAN_SECRET_KEY` itself. The key is wired into three places:

- JWT access-token signing/verification (`backend/src/app.module.ts` → `JwtModule`, used by `auth/token.service.ts` and `core/jwt.guard.ts`)
- `cookie-parser`'s secret (`backend/src/main.ts`)
- the cache-token HMAC (`backend/src/core/cache-token.service.ts`)

## Problem
Changing `KERGHAN_SECRET_KEY` today instantly invalidates every outstanding access token: `JwtGuard` rejects them and every logged-in user gets a `401` until their client refreshes. There is no way to introduce a new key while the old one is still honoured, and no documented procedure for doing it.

Current impact per consumer:

- **JWT** — the only consumer with real impact. Access tokens are short-lived (`KERGHAN_ACCESS_TOKEN_TTL_MS`, default 15 min), so an overlap window equal to the TTL is enough.
- **cookie-parser** — no cookie is currently signed (`access_token` is set without `signed: true`, and `req.signedCookies` is never read), so rotating the key has no effect here today.
- **Cache token** — `CacheTokenService` is registered but has no callers yet; the value is a deterministic HMAC used as a cache key, so it cannot be "verified against several keys" — a rotation simply changes every user's cache key.
- Refresh tokens are random values stored as SHA-256 hashes and do not depend on the key.

## Expected Behavior
- An operator can roll the secret with zero downtime: deploy the new key as current while keeping the old one as a previous key, wait at least one access-token TTL, then drop the old key.
- New JWTs are always signed with the current key; incoming JWTs are accepted if they verify against the current key or any configured previous key.
- `cookie-parser` receives the full key list (it natively accepts an array, trying each in order).
- The cache token is always derived from the current key only.
- The rotation procedure is documented.

## Solution
- Keep `KERGHAN_SECRET_KEY` as the current key (existing deployments need no change) and add an optional `KERGHAN_PREVIOUS_SECRET_KEYS` env var (comma-separated list of retired keys).
- Centralise key resolution in a small core helper/service (e.g. `SecretKeysService` / `buildSecretKeys(configService)`) returning `{ current, all }`, trimming blanks and de-duplicating.
- JWT: keep signing with the current key; make `JwtGuard`'s verification try the current key first, then each previous key (e.g. via `secretOrKeyProvider` / explicit `verify(token, { secret })` fallbacks), rejecting only if none match.
- `main.ts`: pass the `[current, ...previous]` array to `cookieParser`.
- `CacheTokenService`: keep using the current key only (document that rotation changes cache keys, which just causes cache misses).
- Docs: update `docs/agents/environment-variables.md` (document the new var and correct the `KERGHAN_SECRET_KEY` row, which currently implies cookies are actively signed), `docs/agents/modules/auth.md`, and `.env.dev.sample`. The rotation runbook (put new key in `KERGHAN_SECRET_KEY` → move old one to `KERGHAN_PREVIOUS_SECRET_KEYS` → wait ≥ access-token TTL → remove old key) lives in those two docs — no separate operations doc.
- Specs covering: token signed with a previous key is accepted; token signed with an unknown key is rejected; new tokens are signed with the current key.

## Out of scope
- Splitting `KERGHAN_SECRET_KEY` into separate per-purpose secrets (JWT / cookies / cache token).

## Benefits
- The secret can be rotated routinely or after a suspected leak without logging every user out.
- One place owns key resolution, so future consumers (signed cookies, the cache token once it's wired up) get rotation for free.
- The documented procedure removes guesswork from an operational task.
