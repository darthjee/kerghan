# Backend Plan: Fix login flow

Main plan: [plan.md](plan.md)

## Shared contracts

- Exposes `DELETE /auth/logoff.json` (renamed from `POST /auth/logout.json`) — see
  [plan.md](plan.md)'s "Shared contracts" for the exact request/response shape `frontend` will
  call.
- `POST /auth/login.json` / `register.json` / `refresh.json` response shape and the existing
  `401` behavior on invalid/expired tokens are unchanged — no action needed here beyond what
  already exists.

## Implementation Steps

### Step 1 — Rename `POST /auth/logout.json` to `DELETE /auth/logoff.json`

Change the route's HTTP method and path. No deprecated alias: there is no working frontend
caller of the old route today, so nothing depends on it staying reachable.

- `backend/src/auth/auth.controller.ts` — change `@Post('logout.json')` to
  `@Delete('logoff.json')` (import `Delete` from `@nestjs/common`); keep the handler name,
  `RefreshTokenDto` body, `204 No Content` status, and cookie-clearing/`X-Skip-Cache` behavior
  unchanged.
- `backend/src/auth/tests/` — update whichever spec(s) currently exercise
  `POST /auth/logout.json` (route/method, cookie clearing, `X-Skip-Cache`) to the new
  `DELETE /auth/logoff.json`.
- `docs/agents/modules/auth.md` — update the routes table's `logout.json` row and the
  "Logout" bullet under "JWT/refresh-token flow" to `DELETE /auth/logoff.json`.
- `docs/agents/backend/routes/auth.md` — update the `POST /auth/logout.json` section heading
  and method to `DELETE /auth/logoff.json`.

### Step 2 — Make the access-token expiry configurable

Extend the access token's lifetime from 15 minutes to 1 hour, via a new env var,
`KERGHAN_ACCESS_TOKEN_TTL_MS`, read through `ConfigService`. **This must land in two places,
driven by the same value** — extending only one leaves the effective session length capped by
the shorter of the two:

- `backend/src/app.module.ts:46` — `JwtModule.registerAsync`'s `signOptions: { expiresIn: '15m'
  }` governs the signed JWT's own validity. Read `KERGHAN_ACCESS_TOKEN_TTL_MS` (milliseconds)
  via the already-injected `ConfigService` and pass it as `expiresIn` (NestJS/`jsonwebtoken`
  accept a millisecond number here, not just duration strings — no format conversion needed).
  Default to `900000` (15 minutes) when unset, matching today's behavior.
- `backend/src/auth/auth.controller.ts` — replace the hardcoded `ACCESS_TOKEN_MAX_AGE_MS`
  constant with a value read from `ConfigService` (inject it into `AuthController`, following
  the same DI pattern as `CacheTokenService`'s `ConfigService` usage), using the same
  `KERGHAN_ACCESS_TOKEN_TTL_MS` var and the same `900000` default, so the cookie's `maxAge`
  always matches the JWT's actual expiry.
- `.env.dev.sample` — add `KERGHAN_ACCESS_TOKEN_TTL_MS=3600000` (1 hour) alongside the other
  `KERGHAN_*` settings.
- `docs/agents/environment-variables.md` — document `KERGHAN_ACCESS_TOKEN_TTL_MS` in the same
  table as the other **Consumed** backend vars (see `KERGHAN_SECRET_KEY`'s row for the format),
  noting it drives both the JWT's `signOptions.expiresIn` and the cookie's `maxAge`, and its
  default (`900000`) when unset.
- `docs/agents/modules/auth.md` — replace the "15 minute expiry" mention under
  "JWT/refresh-token flow" with a reference to the new configurable default.
- `backend/src/auth/tests/` and/or a new `app.module.spec.ts`/`auth.controller.spec.ts` — cover
  both the default (env var unset) and an overridden `KERGHAN_ACCESS_TOKEN_TTL_MS` value,
  asserting the cookie's `maxAge` and (where feasible) the signed token's `exp` claim reflect it.

## Files to Change

- `backend/src/auth/auth.controller.ts` — route rename; `ACCESS_TOKEN_MAX_AGE_MS` replaced by a
  `ConfigService`-backed value
- `backend/src/app.module.ts` — `JwtModule.registerAsync`'s `signOptions.expiresIn` reads
  `KERGHAN_ACCESS_TOKEN_TTL_MS`
- `backend/src/auth/tests/` — spec updates/additions for both steps
- `.env.dev.sample` — new `KERGHAN_ACCESS_TOKEN_TTL_MS` sample value
- `docs/agents/modules/auth.md` — route rename + expiry wording
- `docs/agents/backend/routes/auth.md` — route rename
- `docs/agents/environment-variables.md` — new env var row

## CI Checks

- `backend`: `npm run coverage` (CI job: `backend_tests`)
- `backend`: `npm run lint` (CI job: `backend_checks`)

## Notes

- No deprecated alias for the old `POST /auth/logout.json` route — confirmed during
  `discuss-issue` that no working caller exists yet for it.
- `KERGHAN_ALLOWED_ORIGINS` is listed as "Reserved, not yet read" in
  `docs/agents/environment-variables.md` — unrelated to this issue, do not touch it.
