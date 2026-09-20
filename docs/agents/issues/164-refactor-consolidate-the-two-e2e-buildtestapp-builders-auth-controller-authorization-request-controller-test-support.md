# Issue: Refactor: consolidate the two e2e buildTestApp() builders (auth.controller / authorization-request.controller test-support)

## Description
Two e2e test-support files each define their own `buildTestApp()` with largely identical Nest module wiring (~59 duplicated lines across five clones).

## Problem
jscpd finds five clones between `backend/src/auth/tests/auth.controller.e2e-test-support.ts` and `backend/src/auth/tests/authorization-request.controller.e2e-test-support.ts` (lines 90-106/49-64, 13-26/11-24, 70-79/31-40, 2-10, 79-87/40-48). Both register `ConfigModule`, `EventEmitterModule`, `JwtModule`, `LoggingModule`, `AuthModule`, the `APP_GUARD`/`JwtGuard` and `APP_INTERCEPTOR`/`SkipCacheInterceptor` providers, override the same six repository tokens (`User`, `RefreshToken`, `Session`, `PasswordResetToken`, `AuthorizationRequest`, `AccountEditLockout`) with `createInMemoryRepo()`, and register the `darthjee` test user via `POST /auth/register.json`.

They differ only in options and return shape:
- `auth.controller.e2e-test-support.ts` takes `{ adminGuard, registerDefaultUser }`, adds the throwaway `ProtectedTestController`/`PublicTestController`, optionally registers `APP_GUARD`/`AdminGuard` after `JwtGuard`, and returns `{ app, userRepo, refreshTokenRepo, passwordResetTokenRepo }`.
- `authorization-request.controller.e2e-test-support.ts` takes `configOverrides` (stubbing `ConfigService#get` only when non-empty), registers no extra controllers, always registers the default user, returns `{ app, userRepo, authorizationRequestRepo }`, and also exports `login()`/`createAuthorizationRequest()`.

Both files also re-export `createInMemoryRepo`/`matchesCondition`, which the specs import from them.

## Expected Behavior
A single base builder owns the common module wiring; the two support files add only their specific options/helpers. Every existing e2e spec passes unchanged.

## Solution
Extract a shared `buildAuthTestApp({ adminGuard, registerDefaultUser, configOverrides, controllers })` into a new module next to the existing `backend/src/auth/tests/support/in-memory-repo.ts` (e.g. `support/build-auth-test-app.ts`). It builds the module, applies the six repository overrides, conditionally overrides `ConfigService`, initialises the app (cookie-parser + `ValidationPipe`), optionally registers the default user, and returns `app` plus all six in-memory repos.

Make the two existing `buildTestApp` functions thin wrappers around it, keeping their current signatures and narrower return types (so no spec needs editing). `ProtectedTestController`/`PublicTestController` stay in the auth support file and are passed in via `controllers`; `login()`/`createAuthorizationRequest()` stay in the authorization-request support file; the `createInMemoryRepo`/`matchesCondition` re-exports stay where they are.

## Benefits
Adding a repository, guard or provider to the Auth module currently means editing the test wiring twice; this makes it a single edit.
