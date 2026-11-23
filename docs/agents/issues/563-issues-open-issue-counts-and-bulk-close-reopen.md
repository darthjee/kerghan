# Issue: Issues: open-issue counts and bulk close/reopen

## Description

This issue is part of epic #483 (Issues and Projects). Kerghan gets **projects**, each optionally connected to one repository. It also gets **issues** that belong to a project and may be linked one to one to a GitHub issue. Background workers keep each linked pair in sync both ways. The specs define the feature in `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md`, and the lifecycle is in `docs/agents/specs.md`. The specification phase is finished.

This issue builds the last piece of v1: the **open-issue count on project rows** and **bulk close and reopen** on the issue list. #507 brought both into v1 and specified them; it is closed and its spec changes are on `main`. The specs are the source of truth, and this issue makes no product decision of its own. If a decision has to change, the same PR updates the spec (`docs/agents/specs.md`, lifecycle step 2). #492 spawned the implementation issues.

## Builds against

- `docs/agents/specs/issues.md` (the index)
- `docs/agents/specs/issues/api/issues.md#bulk-close-and-reopen` (the route, the response, the order of checks, the transaction and lock order, the concurrency rules)
- `docs/agents/specs/issues/api/errors-and-validation.md` (the `issueIds` and `state` validation rows, the uuid case, `ISSUE_EDIT_RATE_LIMITED`)
- `docs/agents/specs/issues/api/projects.md#open-issue-count` (already built: only E73 is left)
- `docs/agents/specs/issues/api.md#required-tests` (the count and bulk rows, and the access-matrix row)
- `docs/agents/specs/issues/security.md#request-rate-limits` (the bulk weight, a refused call consumes nothing) and `#review-checklist`
- `docs/agents/specs/issues/edge-cases.md#counts-and-bulk` (E66 to E74)
- `docs/agents/specs/issues/ui/states.md#scope` (the count and the bulk bar) and the error-message map (the countdown on the bulk bar)
- `docs/agents/specs/issues/ui.md#required-tests` (Counts and bulk)
- `docs/agents/specs/issues/testing.md` (the access matrix row and bulk weight, the edge-case allowlist, the frontend tests)

## Depends on

- #507 (Issues specs: open-issue counts and bulk close/reopen), closed
- #555 (Issues: projects API), merged: `openIssueCount` is already on every project object
- #556 (Issues: issues API), merged
- #559 (Issues: security verification), merged: the route access matrix
- #561 (Issues: frontend 2), merged: the issue list
- #562 (Issues: frontend 3): the issue list's header and empty states change there too, so this issue goes after it

## What already exists (reuse, do not redo)

- **Count, backend:** `backend/src/issues/open-issue-count.query.ts` (`forPage`, `forProject`) and `openIssueCount` in `project-response.ts`, wired in `projects.service.ts` and tested in `projects.service.listing.db-spec.ts`. Nothing to build but the E73 citation.
- **Single edit:** the issue edit path of `issues.service.ts`, with `issue-edit-rate-limiter.ts`, `issue-markers.ts` and `issue-sync-enqueuer.ts`. Bulk follows its rules and reuses these pieces.
- **Access matrix:** `backend/src/issues/tests/support/registered-routes.ts` (`ROUTE_ROWS`), whose completeness check fails until the `bulk-state` row is added.
- **Edge-case sweep:** `backend/src/issues/tests/edge-cases.coverage.spec.ts`, whose `ALLOWLIST` holds E66 to E74 for #563.
- **Frontend:** `client/IssuesClient.js`; the issue list under `components/resources/issues/list/` (`IssuesController.js`, `IssuesTableHelper.jsx`, `IssuesHandlers.js`, and the rest); `components/common/forms/RateLimitCountdownController.js`; the error map in `components/resources/projects/errors/errorMessages.js`; `projects/pages/list/helpers/ProjectsTableHelper.jsx`; `frontend/specs/support/issuesBuilders.js` (already builds `openIssueCount`).

## Task

Both parts ship in one PR; the plan splits the work between the `backend` and `frontend` agents.

**Backend (`backend`):**

- `POST /projects/:projectId/issues/bulk-state.json`, body `{ issueIds, state }`, answering `200 { state, changed, unchanged, notFound }`, exactly as `api/issues.md#bulk-close-and-reopen` specifies:
  - DTO validation: 1 to 100 uuid strings, duplicates rejected case-insensitively, `state` required (`open` or `closed`); ids matched and echoed lowercased.
  - The edit rate limit, weighted by the id count, all or nothing. A refused call consumes nothing.
  - The project access check (`404`), then one transaction in the module's lock order: the project row, the issues in internal-id order, their links, their markers.
  - Per-issue outcomes in request order. `gone` links change locally only (no marker, no T1). One T1 per changed `linked`/`sync_failed` link is enqueued after the commit.
  - A thin controller, with the logic in a service. It declares `@CachePolicy(CacheClass.UserScoped)` and sends `X-Skip-Cache`; nothing goes in Navi.
- Add the `bulk-state` row and its bulk weight to `ROUTE_ROWS`.
- Specs for E66 to E74 (the `(db)` races and the rate-limit boundary with the `FakeClock`), plus an E73-tagged count spec. Remove E66 to E74 from the edge-case `ALLOWLIST`.

**Frontend (`frontend`):**

- `IssuesClient.bulkState(projectId, { issueIds, state })`.
- **The count on project rows:** a third "Open issues" column after Repository, showing "N open" ("0 open" included) as muted text from `openIssueCount`, on list rows only. It is never compared with the issue list's total. The existing spec that asserts the count is absent is inverted. The spec gives only the wording, so the same PR records the column in `ui/states.md#scope`.
- **Bulk on the issue list:**
  - a checkbox column, and a "select all on this page" checkbox
  - a bar with "Close selected" and "Reopen selected", shown when at least one row is selected
  - the selection is limited to the current page and cleared on a page, filter or search change
  - the summary notice: "Closed N issues" ("Reopened N issues"), "M were already closed" ("M were already open") when `unchanged` is not empty, and "K were no longer found" when `notFound` is not empty
  - then one re-read of the page (no bounded re-read on the list)
  - `429 ISSUE_EDIT_RATE_LIMITED`: the bar's buttons show "Try again in N s" through `RateLimitCountdownController`, and the selection is kept
  - U2 on both buttons
- **Docs:** update `docs/agents/architecture/frontend.md` (the count and the bulk bar) and the backend architecture doc for the new route.

## Out of scope

- Other bulk actions (delete, refresh, unlink), counts other than open issues, and sorting or filtering by count (`ui/states.md#scope`).

## Acceptance criteria

- Every Required test of `api.md#required-tests`, `ui.md#required-tests` (Counts and bulk), `security.md` (the bulk weight) and `testing.md` that falls in this scope is implemented, on the tier `testing.md` gives.
- The `bulk-state` row is in the route access matrix, and its completeness check passes.
- Specs cite E66 to E74, and those ids are no longer in the edge-case `ALLOWLIST`.
- No decision differs from the specs. If one has to, the same PR updates the spec. The same PR also aligns the #563 row of the implementation table in `docs/agents/specs/issues.md` with the *Builds against* list above.
- The checks pass:
  - `docker-compose run kerghan_tests yarn coverage`
  - `docker-compose run kerghan_tests yarn lint`
  - `docker-compose run kerghan_fe yarn coverage`
  - `docker-compose run kerghan_fe yarn lint`

## Notes

- **Responsible agents:** `backend` and `frontend`.
- **Review:** `cache` (the cache class and `X-Skip-Cache`), and `security` and `data-access` for `security.md#review-checklist` (ids only in the response, the weight, `notFound` hiding other projects' and users' issues).
