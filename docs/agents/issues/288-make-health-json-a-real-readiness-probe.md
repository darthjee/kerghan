# Issue: Make /health.json a real readiness probe

## Description
`GET /health.json` (`backend/src/health/health.controller.ts`) always returns `200 { "status": "ok" }` without checking any dependency, so it only proves the Node process is answering HTTP — not that the backend can actually serve requests.

## Problem
- The endpoint never touches the database (MySQL via TypeORM), so it reports healthy even when the DB is unreachable and every real request would fail.
- There is no way to distinguish "process is alive" (liveness) from "app can serve traffic" (readiness).
- It can never return a non-2xx status, so an orchestrator or monitor relying on it would never take the instance out of rotation.

## Expected Behavior
- `GET /health.json` remains a **liveness** probe: cheap, no dependency checks, always `200 { "status": "ok" }` while the process is up (current contract unchanged).
- New `GET /ready.json` is the **readiness** probe:
  - Checks database connectivity only. SMTP and the GitHub API are deliberately **not** checked — an outage there must not take the backend out of rotation.
  - All checks pass → `200 { "status": "ok", "checks": { "database": "up" } }`.
  - Any check fails → `503 { "status": "error", "checks": { "database": "down" } }`.
  - The public body exposes only per-check up/down — never error messages, hostnames or stack traces; failure details go to the logs.
- Both endpoints are `@Public()` and `@CachePolicy(CacheClass.Never)` (sending `X-Skip-Cache`), so they are never answered from Tent's cache.

## Solution
- Add a hand-rolled `HealthService` in `backend/src/health/` (no `@nestjs/terminus` or other new dependency) that runs the database check via a cheap `SELECT 1` on the injected TypeORM `DataSource`, catching and logging failures.
- Keep `HealthController` thin: `check()` stays as-is for `/health.json`; a new `ready()` handler for `/ready.json` delegates to the service and responds `503` (with the per-check body) when not ready.
- Specs: controller spec for both routes (200/503 paths, cache headers), service spec for the DB check up/down.
- Docs: update `docs/agents/architecture/backend.md`, `security.md` (public `GET` routes list) and `caching.md` as needed to mention `/ready.json`. Confirm the `cache` agent's navi config needs no warming entry for it (never-cached).

## Benefits
- Monitoring and deploy tooling can detect a backend that is up but unable to reach its database.
- Separate liveness/readiness contracts let a future orchestrator restart dead processes without restarting instances that are merely waiting on the DB.
- No new dependency, and no internal details leaked through a public endpoint.
