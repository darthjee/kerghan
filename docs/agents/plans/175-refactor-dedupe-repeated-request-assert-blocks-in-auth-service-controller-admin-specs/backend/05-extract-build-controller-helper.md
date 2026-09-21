# Extract buildController helper in auth.controller.spec
`auth.controller.spec.ts` repeats the `ConfigService` double (`{ get: jest.fn((_key, defaultValue) => defaultValue) }`) and `new AuthController(authService, configService[, accountService])` construction five times (cookie-maxAge tests, logoff, `PATCH /auth/account.json`); one `describe` (`POST /auth/status.json`) already defines a local `buildController()`.

Hoist a single `buildController({ configService, accountService })` to the top-level `describe('AuthController')` scope (it needs `authService`, assigned in the outer `beforeEach`), defaulting `configService` to the pass-through double via a small `defaultConfigService()` helper. Tests that assert on `configService.get` (the `KERGHAN_ACCESS_TOKEN_TTL_MS` default test) or return a fixed value (`3_600_000`) pass their own double in and keep asserting against it. Remove the now-redundant local `buildController` in the status describe. Keep the call arity the controller constructor expects (two args normally, three when an `accountService` is supplied).

## Files to Change
- `backend/src/auth/tests/auth.controller.spec.ts` — hoisted `buildController`/`defaultConfigService`, used by every test that constructs the controller.
