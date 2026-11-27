# Wire the probes in `HealthController`

Keep the controller thin:

- `GET health.json`: `@Public()`, `@HttpCode(200)`, returns `this.healthService.liveness()`. Update the return type to `LivenessResult`.
- `GET ready.json`: unchanged mechanism (`@Res({ passthrough: true })`, status set, never thrown), but the code is `503` only when `result.status === 'error'`. `ok` and `degraded` both answer `200`.
- The class keeps `@CachePolicy(CacheClass.Never)`.
- Update the class and method JSDoc: liveness now carries the identity and version and still touches no dependency; readiness checks the database and workers, and `degraded` answers `200`.

Specs in `health.controller.spec.ts`:

- `GET /health.json` returns `200` with `app: 'kerghan'`, `status: 'ok'` and `version`;
- `GET /ready.json` answers `200` for `ok` and `degraded`, and `503` for `error`, with the probe body (not the standard error shape from `HttpExceptionFilter`);
- both routes keep `CacheClass.Never` (`X-Skip-Cache` present) and are reachable without a token.

## Files to Change

- `backend/src/health/health.controller.ts` — delegate liveness, `503` only on `error`, JSDoc
- `backend/src/health/tests/health.controller.spec.ts` — the specs above
