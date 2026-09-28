# Add the GET /ready.json route
Extend `HealthController` (keeping its class-level `@CachePolicy(CacheClass.Never)`):

- Inject `HealthService` via the constructor.
- Leave `check()` / `GET /health.json` exactly as it is (liveness).
- Add `@Public() @Get('ready.json') async ready(@Res({ passthrough: true }) res: Response)` that calls `healthService.checkReadiness()`, sets `res.status(503)` when `status === 'error'` (200 otherwise) and returns the result body unchanged. Do not throw — see the plan Notes on `HttpExceptionFilter`.
- Update the class JSDoc to describe the liveness/readiness split.

Update `backend/src/health/tests/health.controller.spec.ts`:
- Provide a mocked `HealthService` in the testing module (the existing `new HealthController()` unit test must pass the mock too).
- Keep the existing `/health.json` assertions (200, `X-Skip-Cache: true`, `Cache-Control: no-store`).
- `GET /ready.json` when the service reports ready → 200 with the `up` body.
- `GET /ready.json` when the service reports not ready → 503 with exactly `{ status: 'error', checks: { database: 'down' } }`.
- Both `/ready.json` cases send `X-Skip-Cache: true` and `Cache-Control: no-store`.

## Files to Change
- `backend/src/health/health.controller.ts` — inject `HealthService`, add `ready()` for `/ready.json`.
- `backend/src/health/tests/health.controller.spec.ts` — cover `/ready.json` 200/503 and cache headers.
