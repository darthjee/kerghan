# Unit specs + e2e coverage

All specs live under `backend/src/core/tests/`, `@swc/jest` transform, no live DB.

## `request-context.service.spec.ts` (new, unit)

- `getRequestId()` returns `undefined` when called outside any `run()`.
- Inside `service.run('abc', () => ...)`, `getRequestId()` returns `'abc'`.
- Nested `run()` calls: the inner `requestId` shadows the outer within its callback, and the
  outer value is restored afterwards.
- `run()` returns the callback's return value.
- Service instantiated directly (`new RequestContextService()`), no `TestingModule` — matches
  the `cache-token.service.spec.ts` style.

## `log-context.spec.ts` (new, unit)

- Build a `LoggerService` double (`{ debug, info, warn, error } = jest.fn()`).
- `new LogContext(logger, { requestId: 'r1', scope: 'job' })`:
  - `.info('hi')` calls `logger.info('hi', { requestId: 'r1', scope: 'job' })`.
  - `.warn('hi', { extra: 1 })` calls `logger.warn('hi', { requestId: 'r1', scope: 'job',
    extra: 1 })`.
  - per-call key wins: `.info('hi', { scope: 'override' })` →
    `logger.info('hi', { requestId: 'r1', scope: 'override' })`.
  - mutating the object passed to the constructor afterwards does not change later calls
    (defensive copy).

## `logger.service.spec.ts` (edit)

- **Every** `new LoggerService(buildConfigService(...) as never)` call site gains a second
  arg — a `RequestContextService` double. Add a helper
  `buildRequestContext(requestId?: string)` returning
  `{ getRequestId: jest.fn(() => requestId) }` and pass `buildRequestContext() as never` by
  default (no active context → all existing assertions stay valid, including the single-arg
  `console[level](message)` cases).
- New `describe('request context correlation')`:
  - with `buildRequestContext('req-1')`: `service.info('msg')` →
    `console.info('msg', { requestId: 'req-1' })`.
  - `service.info('msg', { userId: 7 })` →
    `console.info('msg', { requestId: 'req-1', userId: 7 })`.
  - caller key wins: `service.info('msg', { requestId: 'caller' })` →
    `console.info('msg', { requestId: 'caller' })`.
  - with no context (`buildRequestContext()`): `service.info('msg')` →
    `console.info('msg')` (unchanged single-arg path).

## `request-logging.e2e-spec.ts` (new, e2e)

Real `INestApplication` via `Test.createTestingModule`, driven by `supertest`. No DB
entities needed — use `@Public()` routes and no `AuthModule`.

### Test module

- `imports`: `ConfigModule.forRoot({ isGlobal: true })`, `LoggingModule`,
  `JwtModule.register({ global: true, secret: 'test-secret', signOptions: { expiresIn:
  '15m' } })`.
- `controllers`: `HealthController` (`GET /health.json`, `@Public()`), plus a throwaway
  in-file controller:
  - `@Public() @Get('ping.json')` handler that injects `LoggerService` and calls
    `this.logger.info('handler-line')` before returning `{ ok: true }` — used to prove two
    log calls in one request share a `requestId`.
  - `@Get('protected.json')` handler with **no** `@Public()` — used for the 401 case.
- `providers`: `{ provide: APP_GUARD, useClass: JwtGuard }`,
  `{ provide: APP_GUARD, useClass: AdminGuard }`.
- The test module class `implements NestModule` and its `configure()` applies
  `RequestContextMiddleware` to `forRoutes('*')` — mirrors `AppModule` (step 04).
- `app = moduleRef.createNestApplication(); app.use(cookieParser()); await app.init();`
  (`ValidationPipe` optional here).
- Spy on `console.info` (`jest.spyOn(console, 'info').mockImplementation(() => undefined)`),
  cleared per test, restored in `afterAll`. Also spy `console.debug/warn/error` to keep
  output quiet.

### Assertions

1. **One access-log line, right shape**: `GET /health.json` → `console.info` called exactly
   once with `'request'` and an object deep-equal to
   `{ method: 'GET', path: '/health.json', statusCode: 200, requestId: <string> }`.
2. **`requestId` is a UUID v4**: matches
   `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`.
3. **Distinct per request**: two sequential `GET /health.json` calls log two different
   `requestId` values.
4. **Correlation across calls in one request**: `GET /ping.json` produces a
   `console.info('handler-line', { requestId: X })` **and** a
   `console.info('request', { ..., requestId: X })` with the **same** `X`.
5. **Guard-rejected requests are logged**: `GET /protected.json` with no cookie → response
   401 **and** `console.info` called with `'request'` and `statusCode: 401`.
6. **No secret ever logged**: `GET /health.json` with header
   `Cookie: access_token=super-secret-value` set → still exactly one access-log line, and
   `JSON.stringify` of every `console.info` call argument contains neither
   `'super-secret-value'` nor `'access_token'` nor `'cookie'` (case-insensitive) nor
   `'authorization'`.

## Coverage

CI's `backend_tests` runs `npm run coverage` with thresholds — the new files
(`request-context.service.ts`, `log-context.ts`, `request-context.middleware.ts`) must be
fully exercised by the specs above. The `res.on('finish')` path is covered by every
`supertest` request; the "no context" branch of `LoggerService.write()` is covered by the
existing spec cases retained with the default `buildRequestContext()` double.

## Files to Change

- `backend/src/core/tests/request-context.service.spec.ts` — new.
- `backend/src/core/tests/log-context.spec.ts` — new.
- `backend/src/core/tests/logger.service.spec.ts` — edit: `RequestContextService` double at
  every construction site; new correlation `describe`.
- `backend/src/core/tests/request-logging.e2e-spec.ts` — new: end-to-end middleware +
  correlation + no-secret-leak coverage.
