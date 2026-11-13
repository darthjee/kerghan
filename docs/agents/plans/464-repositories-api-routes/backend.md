# Backend Plan: Repositories: API routes

Main plan: [plan.md](plan.md)

## Overview

This plan adds the HTTP layer on top of the Repositories data layer that #463 merged. That layer includes `RepositoriesService`, `AddStore`, the listing query and the sync engine. It also includes the Integrations export: `IntegrationsGithubService#getRepository` and `#listUsableIntegrations`, plus `walkAddCandidates` in `integrations/add-candidate-walk.ts`.

None of that is reimplemented here. #464 adds:

- the controller and its DTOs;
- the Add orchestration, as a service;
- the in-memory Add rate limit;
- the error codes and helpers;
- the ESLint boundary;
- the HTTP-level tests.

## Context

- **Spec:**
  - `docs/agents/specs/repos/api.md`, the whole file;
  - `security.md#module-boundaries` and `#required-tests` (route access matrix, canary sweep, user scoping);
  - `testing.md#access-control-and-leaks`, `#module-boundaries` and `#cache`.
- **Conventions to follow:**
  - **Controller:** `integrations/integrations.controller.ts`. Paths are declared in full with `@Controller()`, `@HttpCode(HttpStatus.OK)` and `@CurrentUser()`. The class carries `@CachePolicy(CacheClass.UserScoped)`.
  - **DTOs:** class-validator classes in `integrations/dto/`. The global `ValidationPipe({ whitelist: true, transform: true })` strips unknown properties.
  - **Errors:** `core/error-codes.ts` plus the module-local helpers, like `integrations/integration-http-errors.ts`. `githubUnavailable()` / `githubRateLimited()` are already in `core/github-http-errors.ts`. The error filter turns a numeric `retryAfterSeconds` into a `Retry-After` header.
  - **Config:** `getNumberConfig` in `core/numeric-config.ts`, and `Clock` / `FakeClock` from `core/clock.ts` and `core/tests/support/fake-clock.ts`.
  - **E2E harness pattern:** `integrations/tests/support/build-integrations-test-app.ts` and `integrations.controller.access.e2e-spec.ts`. Error bodies are asserted with `auth/tests/support/error-body.ts`.
  - **DB harness:** `repositories/tests/support/repositories-db-harness.ts`, `two-user-baseline.ts` and `capturing-launcher.ts`.
- **Test tiers:** `RepositoriesService` runs raw MySQL SQL, so the in-memory repository fake cannot serve it.
  - **Routes, DTOs, guards, headers and error mapping** run as `*.e2e-spec.ts` with a typed `RepositoriesService` fake and the existing `FakeIntegrationsGithubService`.
  - **Flows that need real SQL behind HTTP** run as `*.db-spec.ts` over an HTTP app on the DB tier: the canary sweep, user scoping over routes and the concurrent Adds.

## Steps

- [01 — Error codes, helpers and `retryAfterSeconds` in the body](backend/01-errors.md)
- [02 — In-memory Add rate limiter](backend/02-add-rate-limiter.md)
- [03 — `RepositoryAddService`](backend/03-add-service.md)
- [04 — DTOs, controller, response shaping and wiring](backend/04-controller.md)
- [05 — ESLint boundary and static boundary spec](backend/05-boundaries.md)
- [06 — E2E with fakes: routes, access matrix, cache coverage](backend/06-e2e-specs.md)
- [07 — HTTP over the DB tier: canary sweep, user scoping, concurrent Adds](backend/07-http-db-specs.md)
- [08 — Docs and spec sync](backend/08-docs.md)

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests yarn test` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `make db-tests` (CI job: `backend_db_tests`)

Never run `yarn` on the host.

## Notes

- **The repositories routes need no changes under `navi/`:** they are user-scoped, so they are never warmed. Request the cache agent's read-only review, plus the security and data-access reviews.
- **`walkAddCandidates` maps `invalid_credentials`/`not_found`:** it does this itself, and a `401` already marks the integration `invalid` inside Integrations. Repositories only maps the walk's outcome to HTTP.
- **#466 depends on these response shapes:** keep them exactly as in `api.md` (ISO date strings, `pagination` and `sync` keys).
- **The `retryAfterSeconds` body change is global:** every existing throw site that sets the field also gets it in the body. Update the filter's own specs and any e2e spec that asserted the body has no such field.
