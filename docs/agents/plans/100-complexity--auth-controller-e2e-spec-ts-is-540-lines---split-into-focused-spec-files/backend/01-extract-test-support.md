# Extract shared test support

Create `backend/src/auth/tests/auth.controller.e2e-test-support.ts` holding the
non-test scaffolding currently at the top of `auth.controller.e2e-spec.ts` and inside
its `beforeEach`/`afterEach`:

- The `matchesCondition()` helper (lines ~25-32 of the current file).
- The `createInMemoryRepo<T>()` factory (lines ~37-78).
- The `ProtectedTestController` and `PublicTestController` fixtures used to exercise
  the global `JwtGuard` (lines ~82-97).
- A new `buildTestApp()` async helper that wraps the current `beforeEach` body
  (lines ~105-145): compiles the `Test.createTestingModule` with `ConfigModule`,
  `EventEmitterModule`, `JwtModule`, `LoggingModule`, `AuthModule`, the two test
  controllers, and the `APP_GUARD`/`JwtGuard` provider; overrides the `User`,
  `RefreshToken`, `Session`, `PasswordResetToken`, `AuthorizationRequest`, and
  `AccountEditLockout` repository tokens with fresh `createInMemoryRepo()` instances;
  creates and initializes the Nest application with `cookieParser()` and the global
  `ValidationPipe({ whitelist: true, transform: true })`; registers the `darthjee`
  test user via `POST /auth/register.json`; and returns `{ app, userRepo,
  refreshTokenRepo, passwordResetTokenRepo }` (add other repos to the return shape
  only if a later step's spec file needs to assert against them directly).

This file exports no `describe`/`it` blocks of its own — it is pure setup, imported by
each of the six spec files created in the following steps.

## Files to Change

- `backend/src/auth/tests/auth.controller.e2e-test-support.ts` — new file with the
  shared helpers and fixtures described above.
