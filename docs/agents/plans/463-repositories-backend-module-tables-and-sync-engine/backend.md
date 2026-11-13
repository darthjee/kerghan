# Backend Plan: Repositories: backend module, tables and sync engine

Main plan: [plan.md](plan.md)

## Overview

Build the Repositories module (`backend/src/repositories/`) exactly as specified in:
- `docs/agents/specs/repos/model.md` (except `#github-handle`, which #460 already shipped);
- `docs/agents/specs/repos/sync.md`;
- `docs/agents/specs/repos/edge-cases.md`;
- `docs/agents/specs/repos/testing.md`.

The specs are the source of truth. Read the relevant section before each step, and when a spec turns out to be wrong or underspecified, fix the spec in this PR and say so in the PR description.

## Context

- **What merged slices provide:**
  - #460: `AccountHandleService#getGithubHandle` (`auth/account-handle.service.ts`, exported by `AuthModule`).
  - #461: `IntegrationsGithubService` and its typed results, `walkAddCandidates`, `INTEGRATION_DELETED` / `IntegrationDeletedEvent` (all through `integrations/integrations-github.public.ts`), `Clock` / `SystemClock` (`core/clock.ts`), `FakeClock` (`core/tests/support/fake-clock.ts`), and `FakeIntegrationsGithubService` with `setUsable` / `script` / `hold` / `githubCalls()` (`integrations/tests/support/fake-integrations-github.service.ts`).
  - #462: the DB tier: `*.db-spec.ts`, run by `yarn test:db` (`jest.db.config.ts`). Helpers live in `database/tests/db-tier/` (`getTestDataSource`, `truncateAll`, the truncate-each hook).
- **Conventions:**
  - Migrations are `src/database/migrations/<timestamp>-<module>-<verb>-<table>.ts`; the latest is `20261110120021-auth-add-users-github-handle.ts`. `data-source.ts` loads only timestamp-prefixed files.
  - Claims follow `IntegrationTestCooldownService` (a conditional `UPDATE` through the query builder, then `affected`).
  - Env values go through `getNumberConfig` (`core/numeric-config.ts`).
  - Events: `EventEmitterModule.forRoot()` is in `AppModule`, and listeners use `@OnEvent(name)` (see `auth/events/password-recovery-requested.listener.ts`).
  - Entities are picked up by `autoLoadEntities` through `TypeOrmModule.forFeature`.
- **Module boundaries** (`security.md#module-boundaries`): Repositories imports Integrations only from `integrations-github.public.ts`, and Auth only through `AccountHandleService` and `auth/events/user-deleted.event.ts`. It never imports an Auth or Integrations entity, never names `auth_users` / `integrations` / `secret_iv`, and never calls `fetch`. (#464 adds the ESLint override and the static boundary spec, so respect the boundaries now.)
- **Out of scope** (#464's): the controller, DTOs, guards, cache policy, error codes, the Add GitHub re-check orchestration and the Add rate limit.

## Steps

- [01 — Auth export: manager-aware user read and `UserDeletedEvent`](backend/01-auth-export.md)
- [02 — Module skeleton, entities and migrations](backend/02-module-entities-migrations.md)
- [03 — Sync state: row creation, claim, lease, release and handle reconciliation](backend/03-sync-state-and-claim.md)
- [04 — Sync run: sources, pages, ETags, failures, pruning and link fill](backend/04-sync-run.md)
- [05 — Listeners: `integration.deleted` and `user.deleted`](backend/05-listeners.md)
- [06 — Service API for #464](backend/06-service-api.md)
- [07 — Cross-module race scenarios and the Integrations `(db)` compare-and-set](backend/07-race-scenarios.md)
- [08 — Spec sync](backend/08-spec-sync.md)

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests yarn test` and `yarn lint` (CI jobs: `backend_tests`, `backend_checks`).
- `backend`: `make db-tests` (`yarn test:db` against `kerghan_mysql_test`) (CI job: `backend_db_tests`).
- Never run `yarn` on the host; always go through `docker-compose`.

## Notes

- **Size:** this is the Epic's largest slice. Commit after each step so the PR reads in stages; it stays one PR.
- **Time:** every time value comes from the injected `Clock` and is passed into SQL as a parameter. A static spec (step 04) fails on `NOW()` / `CURRENT_TIMESTAMP` in `src/repositories/**`.
- **No test-only hooks in production code.** The only pause points are the fake's `hold(...)` and the `CapturingLauncher` (`testing.md#concurrency-and-races`).
- **Concurrency specs** (type a) go on the DB tier with `Promise.all` over separate pool connections, assert invariants only, and use no repeat loops.
- **Reviews:** request a security review and a data-access review on the PR.
