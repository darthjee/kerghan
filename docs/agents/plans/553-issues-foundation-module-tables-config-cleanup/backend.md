# Backend Plan: Issues: foundation (module, tables, config, cleanup)

Main plan: [plan.md](plan.md)

## Overview

Create `backend/src/issues/` following the Repositories module pattern (`backend/src/repositories/`): entities, migrations, config, the `user.deleted` listener, the single access check, the DB-tier harness with seed builders and an intruder user, and static specs. No controller, no route, no job. The specs under `docs/agents/specs/issues/` are the source of truth. If a decision has to differ from them, update the spec in the same PR.

## Context

- Specs: `docs/agents/specs/issues/model.md` (tables, indexes, cleanup, lock order), `sync.md#configuration` (nine keys), `security.md#data-at-rest` / `#logs-and-job-params`, `testing.md#fixtures` / `#security-verification`, `edge-cases.md` (E4, E12, E14, E16, E31, E41–E56, E53).
- **Test scope (decided in the issue):** only the schema-level Required tests: migrations up and down; the unique keys, including `uuid`; `deleted_token` written with `deleted_at`; utf8mb4 / `bigint` / `datetime(3)` round-trips; the `user.deleted` cleanup in lock order, with a listener failure logged without blocking; the access check; the two-user baseline; the static specs. Compare-and-clear, the marker upsert on edit, boot re-enqueue, project and issue deletion, bulk state change and the open-issue count belong to later issues.
- **Config reading (decided in the issue):** a new shared helper in `core/`. `RepositoriesConfig` already has a private `positiveInteger()` (`backend/src/repositories/repositories-config.ts`) that wraps `getNumberConfig`. Move it into `core/numeric-config.ts` as `getPositiveIntConfig` and reuse it in both places. `getNumberConfig` and its other callers stay unchanged.
- Patterns to copy: `repositories-events.listener.ts` (listener: one transaction, `try`/`catch`, a safe-field error log), `repositories.module.ts` (an exported `*_PROVIDERS` array shared with the DB harness, `Clock` injected), `entities/index.ts`, migrations `20261113120022…26` built with `helpers.ts`, `tests/support/repositories-db-harness.ts`, `tests/support/two-user-baseline.ts`, `tests/support/module-sources.ts`, `tests/no-sql-now.spec.ts`, `tests/module-boundaries.spec.ts`, `tests/eslint-boundary.spec.ts`, `database/tests/repositories-migrations.db-spec.ts`.

## Steps

- [01 — Shared positive-integer config helper](backend/01-positive-int-config-helper.md)
- [02 — Migrations and entities](backend/02-migrations-and-entities.md)
- [03 — IssuesConfig and environment variables](backend/03-issues-config.md)
- [04 — Module skeleton, wiring and the single access check](backend/04-module-and-access-check.md)
- [05 — `user.deleted` cleanup listener](backend/05-user-deleted-listener.md)
- [06 — DB harness, seed builders and intruder user](backend/06-db-harness-and-seeds.md)
- [07 — Schema-level DB specs](backend/07-schema-db-specs.md)
- [08 — Static specs and lint boundary](backend/08-static-specs.md)

## CI Checks

Always run these through `docker-compose`, never on the host:

- `backend`: `npm run lint`, `npm run test` (CI job: backend `npm run << parameters.script >>`)
- `backend`: `npm run test:db` (CI job: the DB-tier job)

## Notes

- Lock order for every multi-table write: projects, then issues, then links, then markers (`model.md#cleanup`).
- The live-project predicate is `deleted_token = 0`, not `deleted_at IS NULL`.
- Catch `ER_DUP_ENTRY` at each write that later issues add. #553 has no write path, so the shared `isDuplicateEntry` usage (`integrations/duplicate-entry.ts`, or the Repositories equivalent) is only noted for those issues.
- Repository-removal mechanism: an open question in `model.md`, out of scope here.
- The fold of the persistence statement into permanent docs is #564's job. Do not touch `product.md`, `AGENTS.md` or `CLAUDE.md`.
