# Backend Plan: Refactor: consolidate the two e2e buildTestApp() builders (auth.controller / authorization-request.controller test-support)

Main plan: [plan.md](plan.md)

## Overview
`backend/src/auth/tests/auth.controller.e2e-test-support.ts` and `backend/src/auth/tests/authorization-request.controller.e2e-test-support.ts` each define a `buildTestApp()` with near-identical Nest module wiring (jscpd: five clones, ~59 duplicated lines). Extract a shared `buildAuthTestApp()` into `backend/src/auth/tests/support/` and make both `buildTestApp` functions thin wrappers around it, keeping their current signatures and return types so no spec needs editing.

## Context
Common to both builders: `ConfigModule.forRoot({ isGlobal: true })`, `EventEmitterModule.forRoot()`, `JwtModule.register({ global: true, secret: 'test-secret', signOptions: { expiresIn: '15m' } })`, `LoggingModule`, `AuthModule`, `APP_GUARD`/`JwtGuard`, `APP_INTERCEPTOR`/`SkipCacheInterceptor`, six in-memory repository overrides (`User`, `RefreshToken`, `Session`, `PasswordResetToken`, `AuthorizationRequest`, `AccountEditLockout`), `cookieParser()` + global `ValidationPipe({ whitelist: true, transform: true })`, and registering the `darthjee` user via `POST /auth/register.json`.

Differences to preserve:
- **auth wrapper** — `{ adminGuard = false, registerDefaultUser = true }`; adds `ProtectedTestController`/`PublicTestController`; when `adminGuard`, adds `APP_GUARD`/`AdminGuard` *after* `JwtGuard` (order matters); returns `{ app, userRepo, refreshTokenRepo, passwordResetTokenRepo }`.
- **authorization-request wrapper** — `configOverrides: Record<string, string> = {}`; overrides `ConfigService` with `{ get: (key) => configOverrides[key] }` only when non-empty; no extra controllers; always registers the default user; returns `{ app, userRepo, authorizationRequestRepo }`; also exports `login()`/`createAuthorizationRequest()`.

Both files re-export `createInMemoryRepo`/`matchesCondition`, which specs import from them — these re-exports stay.

## Implementation Steps

### Step 1 — Create the shared builder
Add `backend/src/auth/tests/support/build-auth-test-app.ts` (next to `in-memory-repo.ts`) exporting `buildAuthTestApp({ adminGuard = false, registerDefaultUser = true, configOverrides = {}, controllers = [] })`. It builds the testing module with the common imports/providers, appends `AdminGuard` after `JwtGuard` when `adminGuard` is set, passes `controllers` through, applies the six repository overrides, applies the `ConfigService` override only when `configOverrides` is non-empty, compiles, creates the app (cookie-parser + `ValidationPipe`), inits it, optionally registers the default user, and returns `{ app, userRepo, refreshTokenRepo, sessionRepo, passwordResetTokenRepo, authorizationRequestRepo, accountEditLockoutRepo }`. Keep comments/docs at the density of the surrounding files (move the explanatory header comment from the auth support file here).

### Step 2 — Turn both `buildTestApp` functions into thin wrappers
In `auth.controller.e2e-test-support.ts`, replace the body of `buildTestApp` with a call to `buildAuthTestApp({ adminGuard, registerDefaultUser, controllers: [ProtectedTestController, PublicTestController] })` and return only the currently-returned repos; keep `ProtectedTestController`/`PublicTestController` and the `createInMemoryRepo`/`matchesCondition` re-export there. In `authorization-request.controller.e2e-test-support.ts`, do the same with `buildAuthTestApp({ configOverrides })`, returning `{ app, userRepo, authorizationRequestRepo }`; keep `login()`, `createAuthorizationRequest()` and the re-export. Remove the now-unused imports from both files. Signatures and return types of both `buildTestApp` functions stay identical, so no `*.e2e-spec.ts` changes.

## Files to Change
- `backend/src/auth/tests/support/build-auth-test-app.ts` — new shared builder (Step 1)
- `backend/src/auth/tests/auth.controller.e2e-test-support.ts` — `buildTestApp` becomes a thin wrapper; unused imports removed (Step 2)
- `backend/src/auth/tests/authorization-request.controller.e2e-test-support.ts` — `buildTestApp` becomes a thin wrapper; unused imports removed (Step 2)

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes
- Pure test-support refactor: no production code and no spec file should change. Every existing e2e spec must pass unchanged.
- `AdminGuard` must be registered after `JwtGuard` in `providers`; keep that ordering in the shared builder.
- The `ConfigService` stub must stay conditional (only when `configOverrides` is non-empty) so the auth specs keep the real `ConfigService`.
- Run tooling only via `docker-compose` (see `CLAUDE.md` boundaries) — never `yarn`/`npm` directly on the host.
