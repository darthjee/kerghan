# Plan: Issues: projects API

Issue: [555-issues-projects-api.md](../../issues/555-issues-projects-api.md)

## Overview

The `backend` agent adds the Projects API to the `issues` module: DTOs, a thin `ProjectsController`, the project services and their tests. The specs are the source of truth: `docs/agents/specs/issues/projects.md`, `api.md`, `api/projects.md`, `api/errors-and-validation.md`, `security.md#quotas-and-abuse-limits` and `edge-cases.md` (E25 to E29, E33 to E40). No product decision is made here. If one has to change, the spec is updated in the same PR.

## Context

- **Already merged (#553):** `IssuesModule` with `ISSUES_PROVIDERS`, the four entities (`IssuesProject`, `Issue`, `IssueGithubLink`, `IssuePendingWrite`), `IssuesConfig.maxProjectsPerUser`, `IssuesAccess.findLiveProject(userId, uuid, manager?, { lock })`, and `issues-http-errors.ts` with `projectNotFound()`/`issueNotFound()`. The DB harness and seeds are in `src/issues/tests/support/`.
- **Patterns to copy:** `src/repositories/repositories.controller.ts` (full paths, `@CachePolicy(CacheClass.UserScoped)`, `@CurrentUser()`, `@HttpCode(200)`), the `src/repositories/dto/` DTOs, `repositories-http-errors.ts`, and the test app `src/repositories/tests/support/build-repositories-test-app.ts`.
- **Decisions of the refinement:**
  - `openIssueCount` is built here in full; #563 keeps bulk close/reopen.
  - For E62, only the repository-change side is built and tested here; the full race against link creation is in #557.
  - Only the project error codes are added here.

## Steps

- [01 — Error codes and `error.meta`](backend/01-error-codes-and-meta.md)
- [02 — Code-point validator and project DTOs](backend/02-code-point-validator-and-dtos.md)
- [03 — Repository lookups for projects](backend/03-repository-lookups.md)
- [04 — Project read model and open-issue count](backend/04-read-model-and-count.md)
- [05 — Project creation (both paths)](backend/05-creation.md)
- [06 — Listing, show and edit](backend/06-listing-show-edit.md)
- [07 — Repository change and delete](backend/07-repository-change-and-delete.md)
- [08 — Controller and module wiring](backend/08-controller-and-wiring.md)
- [09 — E2E, DB and race tests](backend/09-tests.md)

## CI Checks

Run everything through `docker-compose`, never on the host:

- `backend`: `yarn test` / `yarn coverage` (CI job: `backend_tests`)
- `backend`: `yarn test:db` against MySQL (CI job: `backend_db_tests`)
- `backend`: `yarn lint` (CI job: `backend_checks`)

## Notes

- **Reviews:**
  - the `cache` agent reviews the cache class (`user-scoped`, `X-Skip-Cache`, nothing in Navi);
  - the `security` and `data-access` agents review against `docs/agents/specs/issues/security.md#review-checklist`.
- **User-row lock for the cap:** `security.md` says the cap is checked under the user-row lock taken by `AccountHandleService.lockExistingUser`. That lock is `FOR SHARE`, and two shared locks do not serialize two creations, so both could pass a cap of `max - 1`.
  - Step 05 adds an exclusive variant in Auth, which owns the query.
  - The cap race test in step 09 proves it.
  - The spec wording is adjusted in the same PR if it names the shared lock.
- **Out of scope:**
  - the refresh trigger route (#558);
  - the issue routes (#556);
  - the link routes and the full E62 race (#557);
  - folding the specs into `docs/agents/backend/routes/` (#564).
