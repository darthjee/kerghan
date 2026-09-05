# Unit specs

Follow `core/tests/cache-token.service.spec.ts`'s pattern: a plain `jest.fn()`-based
`ConfigService` double, service instantiated directly (no `TestingModule` needed to exercise the
service's own behavior in isolation).

Cover:

- Default level is `info` when `ConfigService.get('KERGHAN_LOG_LEVEL', 'info')` isn't overridden by
  the double.
- A configured level override (e.g. `debug`) changes filtering behavior accordingly.
- Level filtering: a call below the configured threshold produces no `console[level]` call (spy on
  `console.debug`/`console.info`/`console.warn`/`console.error`); a call at or above it does.
- Structured attributes reach the console call as the second argument, unmodified.
- `error()` accepts a plain attributes object — no special handling asserted for an `Error`
  instance (just confirm it's treated like any other attributes value).
- NestJS `LoggerService` interface methods: `log()` routes to the same behavior as `info()`
  (including level filtering); `warn`/`error`/`debug` route to their same-named counterparts.

Also add one small `TestingModule`-based spec (unlike the rest, which avoid `TestingModule` per the
project's unit-spec convention) proving the service is actually injectable from *outside* its own
declaring module — build a throwaway module that imports `LoggingModule` (or a minimal stand-in)
and constructor-injects `LoggerService` into a throwaway provider in a *different* module, asserting
the injection succeeds. This is the one behavior that can't be verified with a bare `new
LoggerService(...)` construction, and it's the acceptance criterion the Step 2 registration change
exists to satisfy.

## Files to Change

- `backend/src/core/tests/logger.service.spec.ts` (new) — the specs described above.
