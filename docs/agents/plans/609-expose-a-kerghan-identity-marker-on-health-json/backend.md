# Backend Plan: Expose a Kerghan identity marker on /health.json

Main plan: [plan.md](plan.md)

## Shared contracts

The backend **produces** the probe bodies:

```text
GET /health.json
  200 {"app":"kerghan","status":"ok","version":"<semver>"}

GET /ready.json
  200 {"app":"kerghan","status":"ok","version":"<semver>","checks":{"database":"up","workers":"up"}}
  200 {"app":"kerghan","status":"degraded","version":"<semver>","checks":{"database":"up","workers":"down"}}
  503 {"app":"kerghan","status":"error","version":"<semver>","checks":{"database":"down","workers":"up"|"down"}}
```

- `app` is always `"kerghan"`. `version` is the `version` of `backend/package.json`, and the key is omitted when that file cannot be read.
- `status`: `error` if `database !== "up"`, else `degraded` if `workers !== "up"`, else `ok`. The backend never emits `"down"` or `"unknown"` (reserved for #613).
- `/health.json` is always `200`. `/ready.json` is `200` for `ok`/`degraded` and `503` for `error`, set on the response, never thrown.
- Both routes stay `@Public()` and `@CachePolicy(CacheClass.Never)`.
- No error message, host, stack or credential in any body. Failures are logged through `LoggerService`.

## Steps

- [01 — Add `WorkersService#isRunning()`](backend/01-workers-is-running.md)
- [02 — Identity, version and component checks in `HealthService`](backend/02-health-service.md)
- [03 — Wire the probes in `HealthController`](backend/03-health-controller.md)
- [04 — Update the backend and security docs](backend/04-docs.md)

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests yarn test` and `docker-compose run --rm kerghan_tests yarn lint` (CircleCI `yarn_project` jobs for `backend`)

## Notes

- `health` consuming `workers` is a new inter-module dependency. `WorkersModule` already exports `WorkersService` and is imported by `AppModule`, which also provides `HealthService` and `HealthController`, so plain constructor DI works with no module change. Justify the dependency in `docs/agents/modules/workers.md`: read-only, one boolean, no job data.
- Keep `health.service.ts` under the 300-line and complexity-10 limits. Put the status derivation in a small pure helper (for example `deriveStatus(checks)` in the same file, or `health/health-status.ts`).
- `package.json` sits at `/home/node/app/package.json` in the release image (`dockerfiles/release_kerghan/Dockerfile` copies the whole `backend/` folder), and the compiled service is at `dist/health/health.service.js`, so `../../package.json` from the compiled file resolves in both `src/` (ts-jest/dev) and `dist/`. Verify this against the dev container layout too.
- No new environment variable and no migration.
