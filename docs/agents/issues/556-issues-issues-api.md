# Issue: Issues: issues API

## Description

This is part of the epic #483 (Issues and Projects): Kerghan gets **projects** (optionally connected to one repository) and **issues** that belong to a project and may be linked one to one to a GitHub issue, kept in sync both ways by background workers. The feature is defined as specs under `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md` (the lifecycle is in `docs/agents/specs.md`), and the specification phase is finished. This issue builds the **Issues API** (the Kerghan issues of a project, before any GitHub link). The specs are the source of truth: this issue makes no product decision of its own, and a change of decision updates the spec in the same PR (`docs/agents/specs.md`, lifecycle step 2). The implementation issues were spawned by #492.

## Builds against

- `docs/agents/specs/issues.md` (the index)
- `docs/agents/specs/issues/api/issues.md` (every section except *Bulk close and reopen*), `docs/agents/specs/issues/api.md` and `docs/agents/specs/issues/api/errors-and-validation.md` (the issue fields and codes)
- `docs/agents/specs/issues/model.md#issues-kerghan-issues` and `docs/agents/specs/issues/model.md#issues_pending_writes-the-pending-marker` (the marker upsert on edit), with `docs/agents/specs/issues/sync.md#marker-lifecycle` (creation rules) and `sync.md#triggers` (T1)
- `docs/agents/specs/issues/security.md#quotas-and-abuse-limits` (the issues cap and the edit rate limit)
- `docs/agents/specs/issues/edge-cases.md`: E12 (no-op edit), E54 (4-byte characters), and the model rows that concern the edit path: E42 (two simultaneous edits keep the marker) and E52 (issue update and marker upsert in one transaction). E34 to E40 are project rows, already built by #555. E41, E43, E44, E51 and E53 belong to the sync workers (#558). E45 to E48 belong to the link (#557).

## Task

- The routes `/projects/:projectId/issues.json` (list), `issues/create.json`, and `show`, `edit` and `delete` under `/projects/:projectId/issues/:issueId/`. All are `POST`, `@CachePolicy(CacheClass.UserScoped)`, with uuid path ids (`ParseUUIDPipe`), and go through the single access check (`IssuesAccess`): the project is resolved first, then the issue inside it.
- The **issue object**: `id`, `title`, `body`, `state`, `createdAt`, `updatedAt` with milliseconds, and `link`. Listing rows have no `body`.
- The **listing**: defaults, bounds, `state` filter (`open` by default, `closed`, `all`), a literal LIKE-escaped title search, totals, and the sort `created_at` desc then `id` desc.
- **Create**: validation, an unlinked issue with `state` defaulting to `open`, no GitHub call and no job. It answers `409 ISSUES_LIMIT_REACHED` when the project is full, checked under the project row lock.
- **Edit**: omitted fields are unchanged, `body: null` or `''` clears it, and equal values make no write, no marker and no revision bump (E12). The edit rate limit (`429 ISSUE_EDIT_RATE_LIMITED`, with `Retry-After` and `retryAfterSeconds`) comes after DTO validation and before the access check. A refused call consumes nothing.
- **The marker upsert in the edit transaction** for a `linked` or `sync_failed` link (`INSERT … ON DUPLICATE KEY UPDATE`; `marked_at` on insert, `updated_at` and `revision` on every value change, timestamps from the `Clock`). A `gone` link gets no marker.
- **Delete**: only an unlinked issue. A linked one, in any link state, answers `409 ISSUE_LINKED`. It is a hard delete under the project-row then issue-row lock, and a second delete answers `404`.
- The new error codes `ISSUES_LIMIT_REACHED`, `ISSUE_EDIT_RATE_LIMITED` and `ISSUE_LINKED`, with their helpers in `issues-http-errors.ts`.

## Scope

- **`link` field: `null` plus a seam.** The issue object takes `link` from one presenter that returns `null` when the issue has no link row. #557 owns the link object (`states` precedence, `reason`, `rateLimitedUntil`, `stale`) and fills in that presenter. No link can be created through the API before #557.
- **T1 enqueue: a port with a no-op default.** After the edit transaction commits, the service calls an after-commit sync-trigger port with the ids of the links whose marker was upserted. Nothing is called on rollback. #556 binds a no-op implementation. #558 binds the real enqueue through the mandatory per-link dedupe. Until then markers are durable, and the boot sweep (T5) re-enqueues them, so nothing is lost.
- **`409 ISSUE_LINKED` is built here**, with a DB-backed test on a seeded link (`seedLink`). #557 only re-verifies it with real links.
- **The edit rate limiter takes a weight** (default 1), so #563's bulk call can weigh its id count against the same window without reshaping it. The bulk route itself stays in #563.
- **Not here:** bulk close/reopen (#563); import, attach and unlink, plus the link object (#557); refresh and retry-sync routes, the reconcile job and the dedupe (#558); the route access matrix rows of the security verification (#559).

## Depends on

- #555 (Issues: projects API), merged.

## Acceptance criteria

- The Required tests of every spec file listed under *Builds against* that concern these routes are implemented, each on the tier given by [`testing.md`](https://github.com/darthjee/kerghan/blob/main/docs/agents/specs/issues/testing.md) (default tier by category and the coverage per area). That includes the issues cap race and the two-edits marker case `(db)`.
- A rolled-back edit leaves neither the issue change nor the marker, and calls no sync trigger.
- No decision differs from the specs; if one has to, the spec is updated in the same PR.
- The checks of the owning agent pass.

## Notes

Responsible agent: `backend`.
- Routes: ask the `cache` agent for the cache-class review (`@CachePolicy(CacheClass.UserScoped)`, `X-Skip-Cache`, nothing in Navi), and the `security` and `data-access` agents for the checklists of `docs/agents/specs/issues/security.md#review-checklist`.
