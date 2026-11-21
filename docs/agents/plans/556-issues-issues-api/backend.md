# Plan: Issues: issues API

Issue: [556-issues-issues-api.md](../../issues/556-issues-issues-api.md)

## Overview

This plan adds an `IssuesController` and an `IssuesService` to the existing Issues module (`backend/src/issues/`), next to the projects code that #555 built. It has six routes:

- `POST /projects/:projectId/issues.json`
- `POST /projects/:projectId/issues/create.json`
- `POST /projects/:projectId/issues/:issueId/show.json`
- `POST /projects/:projectId/issues/:issueId/edit.json`
- `POST /projects/:projectId/issues/:issueId/delete.json`

All of them are `POST`, use `@CachePolicy(CacheClass.UserScoped)`, check both ids with `uuidParamPipe()`, and resolve access through `IssuesAccess`: the project first, then the issue inside it.

## Context

- **Specs:**
  - `docs/agents/specs/issues/api/issues.md` (everything except bulk, which is #563);
  - `api/errors-and-validation.md` (the field rules and the three new codes);
  - `model.md#issues-kerghan-issues` and `model.md#issues_pending_writes-the-pending-marker`;
  - `sync.md#marker-lifecycle` and `sync.md#triggers` (T1);
  - `security.md#quotas-and-abuse-limits`.
- **Already in place from #553 and #555:**
  - the `Issue`, `IssueGithubLink` and `IssuePendingWrite` entities;
  - `IssuesAccess.findLiveProject` / `findIssueInProject` with `{ lock }`;
  - `IssuesConfig.maxIssuesPerProject`, `editMaxPerWindow` and `editWindowMs`;
  - `ISSUE_NOT_FOUND_MESSAGE` / `issueNotFound()`;
  - the code-point validators (`core/code-points.validator.ts`) and `core/escape-like.ts`;
  - `stampOf`;
  - the test support (`seedIssue`, `seedLink`, `seedMarker`, `seedIntruder`, the DB and HTTP harnesses).
- **Decided at refinement:**
  - `link` is `null` behind a presenter seam that #557 fills in;
  - the T1 enqueue goes through an after-commit port with a no-op default, bound for real by #558;
  - `409 ISSUE_LINKED` is built here;
  - the edit limiter takes a weight so #563 can reuse it.

## Steps

- [01 — Error codes and helpers](backend/01-error-codes.md)
- [02 — Issue DTOs and field rules](backend/02-dtos.md)
- [03 — Weighted edit rate limiter](backend/03-edit-rate-limiter.md)
- [04 — Store, response and link presenter seam](backend/04-store-response-link-seam.md)
- [05 — Marker upsert and sync-trigger port](backend/05-markers-and-sync-trigger.md)
- [06 — IssuesService](backend/06-issues-service.md)
- [07 — Controller and module wiring](backend/07-controller-and-wiring.md)
- [08 — Tests](backend/08-tests.md)

## CI Checks

Run everything through `docker-compose`, never on the host:

- `backend`: `yarn test` / `yarn coverage` (CI job: `backend_tests`)
- `backend`: `yarn test:db` against MySQL (CI job: `backend_db_tests`)
- `backend`: `yarn lint` (CI job: `backend_checks`)

## Notes

- **Reviews:**
  - the `cache` agent reviews the cache class (`user-scoped`, `X-Skip-Cache`, nothing in Navi);
  - the `security` and `data-access` agents review against `docs/agents/specs/issues/security.md#review-checklist`.
- **Lock order:** projects, issues, links, markers.
  - Create and delete lock the project row first.
  - The single edit does **not** lock the project (`api/issues.md`, "Bulk vs single Edit"). It locks the issue, then its link, then the marker.
  - A project deleted during an edit is caught by the issue lock. The deletion locks the issues `FOR UPDATE`, so the edit either goes first or then finds no row, which answers `404`.
- **Timestamps:**
  - `issues.updated_at` is `datetime(3)` and takes the full-millisecond `Clock` instant;
  - `created_at` and the marker's `datetime` columns use `stampOf` (whole seconds).
- **Rate-limit placement:** after DTO validation and before the access check, so a `429` happens before any project lookup. A refused call consumes nothing.
- **Seams left for later issues:**
  - `IssueLinkPresenter` (#557 fills in the link object);
  - `IssueSyncTrigger` (#558 binds the real enqueue through the per-link dedupe);
  - the limiter's `weight` argument (#563 bulk).
  - Each seam has a short doc comment naming its future owner, and nothing else depends on #557 or #558.
- **Out of scope:**
  - bulk close/reopen (#563);
  - import, attach, unlink and the link object (#557);
  - refresh, retry-sync, the reconcile job and the dedupe (#558);
  - the route access matrix of the security verification (#559), although this PR's own access e2e covers its routes like #555's;
  - folding the specs into `docs/agents/backend/routes/` (#564).
