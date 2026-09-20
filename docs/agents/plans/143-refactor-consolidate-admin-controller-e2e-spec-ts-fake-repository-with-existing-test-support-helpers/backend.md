# Backend Plan: Refactor: consolidate admin.controller.e2e-spec.ts fake repository with existing test-support helpers

Main plan: [plan.md](plan.md)

## Overview
`backend/src/auth/tests/` currently has three copies of the in-memory fake TypeORM repository: one in `auth.controller.e2e-test-support.ts` (supports `isNull`), one in `authorization-request.controller.e2e-test-support.ts` (a superset: `moreThan`, `find({ order })`, `count`, `createQueryBuilder().update()...execute()`, `createdAt` auto-fill), and a private one in `admin.controller.e2e-spec.ts` (`ilike`-aware `find()`, `createdAt` auto-fill, no `matchesCondition`). This plan extracts one superset into a new neutral module, makes both support files use it, extends `buildTestApp()` with options so the admin spec can use it, and deletes the admin spec's private copy.

## Context
Decisions from the issue discussion:
- Full consolidation (all three copies), not just the admin spec.
- Shared repo lives in a new neutral module, `backend/src/auth/tests/support/in-memory-repo.ts`.
- `auth.controller.e2e-test-support.ts`'s `buildTestApp()` gains an options object (`adminGuard`, `registerDefaultUser`); defaults keep current behavior.
- `authorization-request.controller.e2e-test-support.ts`'s own `buildTestApp` (with `configOverrides`) stays separate.

## Steps

- [01 — Extract shared in-memory repo](backend/01-extract-shared-in-memory-repo.md)
- [02 — Point both support files at the shared repo](backend/02-point-support-files-at-shared-repo.md)
- [03 — Add options to auth buildTestApp](backend/03-add-build-test-app-options.md)
- [04 — Migrate the admin spec and update docs](backend/04-migrate-admin-spec-and-docs.md)

## CI Checks
- `backend`: `npm run coverage` (CI job: `backend_tests`) — locally via `docker-compose` (`make tests` shell, per CLAUDE.md never on the host); the full backend suite must stay green, not only the admin spec
- `backend`: `npm run lint` (CI job: `backend_checks`)

## Notes
- Because the shared `save()` now auto-fills `createdAt` for every entity (real TypeORM does this for `@CreateDateColumn` entities), spec assertions on fake-repo rows in other auth specs could change (e.g. a strict `toEqual` on a row). Run the whole backend suite after step 02; if a spec breaks, prefer adjusting the fake to only fill `createdAt` when it is safe, rather than editing spec expectations.
- The "not admin" admin tests register `darthjee` themselves, which is why `registerDefaultUser: false` is needed; `buildTestApp()` also mounts the throwaway `/protected` and `/public` controllers, which are harmless for the admin spec.
- The issue text still references the pre-split `auth.controller.e2e-spec.ts`; the real files are the `auth.controller.*.e2e-spec.ts` set and their support file.
