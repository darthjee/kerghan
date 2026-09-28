# Backend Plan: Make /health.json a real readiness probe

Main plan: [plan.md](plan.md)

## Overview
Add a readiness probe (`GET /ready.json`) backed by a new `HealthService` that checks MySQL connectivity, while `GET /health.json` stays an unchanged liveness probe. No new dependency (`@nestjs/terminus` is explicitly out of scope).

## Context
Today `HealthController.check()` always returns `200 { status: 'ok' }` without touching any dependency. Nothing in docker-compose, CircleCI or `scripts/deploy.sh` consumes it yet, so the new endpoint only has to honour the contract below.

Contract (from the issue):

| Route | Purpose | Success | Failure |
|---|---|---|---|
| `GET /health.json` | liveness | `200 { "status": "ok" }` (unchanged) | — |
| `GET /ready.json` | readiness | `200 { "status": "ok", "checks": { "database": "up" } }` | `503 { "status": "error", "checks": { "database": "down" } }` |

- Only the database is checked; SMTP and the GitHub API are deliberately not.
- The public body never contains error messages, hosts or stack traces; the failure is logged instead.
- Both routes are `@Public()` and inherit the class-level `@CachePolicy(CacheClass.Never)` (`X-Skip-Cache: true`, `Cache-Control: no-store`).

## Steps

- [01 — Add HealthService with the database check](backend/01-add-health-service.md)
- [02 — Add the GET /ready.json route](backend/02-add-ready-route.md)
- [03 — Update docs and comments](backend/03-update-docs.md)

## CI Checks
- `backend`: `docker-compose run kerghan_tests npm test` (CI job: `backend_tests`)
- `backend`: `docker-compose run kerghan_tests npm run lint` (CI job: `backend_checks`)

## Notes
- The 503 response must be produced by setting the status on the response (`@Res({ passthrough: true })`, as `auth.controller.ts` does), **not** by throwing an `HttpException` — `HttpExceptionFilter` would reshape a thrown error into `{ error: {...}, statusCode, timestamp }` and break the contract.
- Make sure the interceptor still sets the cache headers on the 503 path (see [API Caching](../../architecture/caching.md) on which error responses carry cache headers) — cover it in the spec.
- CI has no DB service container: specs must mock `DataSource` (`query`), never hit a real database.
- The navi cache warmer needs no change: `/ready.json` is `never`-cached and must not be warmed.
