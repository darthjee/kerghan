# Backend Plan: Backend: "Keep me signed in" sessions

Main plan: [plan.md](plan.md)

## Overview
`keepSignedIn` flows from the request DTOs (`LoginDto`, `CreateAuthorizationRequestDto`) into
`TokenService#issueTokens`, which stores it on the new `RefreshToken` row and picks the persistent or
regular TTL. `AuthService#refresh` copies the presented row's flag to the rotated token; the device
flow stores the flag on the `AuthorizationRequest` row at create time and passes it when the winning
poll mints the session. Session response bodies are unchanged; only `OpenAuthorizationRequest` gains
`keepSignedIn`.

## Context
- Refresh-token TTL is hardcoded today (`REFRESH_TOKEN_TTL_MS`, 7 days, `backend/src/auth/token.service.ts`).
- Global `ValidationPipe({ whitelist: true, transform: true })` without implicit conversion, so
  `@IsBoolean()` rejects `"true"`/`1` with `400`.
- `ConfigModule` is global; `getNumberConfig` (`backend/src/core/numeric-config.ts`) already falls
  back on unset/NaN. `LoggerService` (`backend/src/core/logger.service.ts`) is the injected logger
  (see `PasswordResetService`).
- Migrations follow `<timestamp>-<module>-<action>.ts` and the `addColumn` precedent in
  `20260903120006-auth-add-users-is-admin.ts`. Specs use mocked repositories (no DB in CI).

## Steps

- [01 — Add keep_signed_in columns](backend/01-add-keep-signed-in-columns.md)
- [02 — Configurable TTLs and keepSignedIn in TokenService](backend/02-token-service-ttls.md)
- [03 — Password login, register and refresh wiring](backend/03-auth-service-wiring.md)
- [04 — Device authorization flow](backend/04-device-authorization-flow.md)

## CI Checks
- `backend`: `docker-compose run kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes
- **Docs and root files are outside the backend agent's scope** — the architect updates them:
  - `docs/agents/environment-variables.md`: `KERGHAN_REFRESH_TOKEN_TTL_MS` (default 7 days) and
    `KERGHAN_PERSISTENT_REFRESH_TOKEN_TTL_MS` (default 30 days): optional, unset/non-numeric/≤0 →
    default (≤0 also logs a one-time warning), applies only to newly minted tokens, persistent expected
    to be longer (not enforced).
  - `docs/agents/modules/auth.md`: `keepSignedIn` in the endpoint table, `keepSignedIn` on the
    `auth_refresh_tokens`/`auth_authorization_requests` entity listings, and the
    "JWT/refresh-token flow" section (configurable TTLs, carry-over on rotation).
  - `docs/agents/backend/routes/auth.md`: `keepSignedIn` on `POST /auth/login.json` and
    `POST /auth/authorization-requests.json` bodies, and on the
    `POST /auth/authorization-requests/mine.json` response items.
  - `.env.dev.sample`: optionally list both new vars (commented out / at their defaults).
- Accepted risk: refresh token readable from `localStorage` (tracked in #324). Row growth tracked in
  #325. Neither is addressed here.
- Reviews: data-access (new `keepSignedIn` response field on `mine.json`), cache (no cache-policy
  change expected on the touched endpoints — all already `CacheClass.Never`).
- Migrations are not spec-tested (no DB in CI, per `docs/agents/architecture/backend.md`); keep
  them minimal and mirror the `is_admin` precedent.
