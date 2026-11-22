# Issue: Issues: security verification

## Description

This is part of the epic #483 (Issues and Projects). Kerghan gets **projects**, each optionally connected to one repository, and **issues**. An issue belongs to a project and may be linked one to one to a GitHub issue, which background workers keep in sync both ways. The feature is defined in `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md`, with the lifecycle in `docs/agents/specs.md`. The specification phase is finished, and #492 spawned the implementation issues.

This issue is the **security verification** of the whole backend feature: the cross-cutting checks that no single issue owns. It closes what #553 to #558 left. The specs are the source of truth, and this issue makes no product decision of its own. If a decision has to change, the spec is updated in the same PR (`docs/agents/specs.md`, lifecycle step 2).

## Builds against

- `docs/agents/specs/issues.md` (the index)
- `docs/agents/specs/issues/security.md` (all of it, especially `#review-checklist` and `#required-tests`)
- `docs/agents/specs/issues/testing.md#security-verification` and `#coverage-per-area`
- `docs/agents/specs/issues/api.md#required-tests`
- `docs/agents/specs/issues/edge-cases.md` (the whole matrix: every row must be covered by some spec)

## Depends on

- #558 (Issues: sync workers), merged.

## What already exists (do not redo)

#553 to #558 already delivered part of `testing.md#security-verification`. This issue reuses those specs and does not duplicate them:

- **Static specs:** all done.
  - `no-sql-now.spec.ts`
  - `module-boundaries.spec.ts`: `secret_iv`, `fetch`, and no Auth or Integrations table or entity.
  - `eslint-boundary.spec.ts`
  - `column-allowlist.spec.ts`: the marker has no payload column.
  - `issues.no-github.spec.ts` and `integrations/tests/integrations-writer-boundary.spec.ts`: only the sync service injects the writer.
  - `integrations/tests/integrations-github-get-only.spec.ts`
  - `core/tests/cache-policy.coverage.spec.ts`: already lists `ProjectsController`, `IssuesController` and `IssueLinksController`.
- **Per-controller access specs:** `{projects,issues,issue-links}.controller.access.e2e-spec.ts`, each with a completeness check over its own controller. Real-database 404s for a foreign, deleted or missing project, or another project's issue, are in `*.routes.db-spec.ts`.
- **Job params, at unit level:** `issue-sync-queue.spec.ts` and `issue-links.sync-triggers.db-spec.ts` check `{ linkId }`.
- **Integrations Required tests:**
  - the writer field rejection;
  - a `301` off-host is not followed, and a rename is followed once;
  - installation-token permission sets;
  - quotas and rate limits;
  - the project-deletion transaction.

## Task

- **Route access matrix.** Write one table-driven e2e spec over every registered Issues route. It replaces the three per-controller access specs, which are folded into it and removed so nothing is duplicated, with one row per route. Its **completeness check** runs against the routes registered across all controllers of the Issues module, so a new route or controller without a row fails.
  - The columns are `401`, `OriginGuard`, `X-Skip-Cache` and `no-store`, no `GET`, a malformed uuid answering `400`, a foreign or deleted project answering a body identical to a missing one, and another project's issue answering the same `404`.
  - It adds the missing **no admin access** column: an admin session gets the same `404` on another user's project and issues.
  - Today 18 of the 19 routes of `api.md#every-route` exist. `bulk-state` comes with #563, and the completeness check forces #563 to add its row.
- **Credential canary sweep.** Wire the **real** Integrations services, with GitHub mocked at the `fetch` level, into an Issues harness, and seed canaries:
  - a PAT, an OAuth token, an installation token, a GitHub App private key and a GitHub error body;
  - reuse `CANARY_*` from `integrations/tests/support/integrations-github-harness.ts`, and add the App-key and error-body canaries.

  Run every sync outcome (success, rate limit, E19 to E22, E24, exhausted retries) and every route, errors included. Assert that no response body or header, no captured log line and no recorded job param contains a canary.
- **Content canary sweep.** A project name and description, an issue title and body, and a repository owner and name carry canary strings. Run them through every route and the reconcile job, refusals and failures included, with the request-logging middleware mounted as in `core/tests/request-logging.e2e-spec.ts`. No log line may contain a canary, and a `4xx` refusal produces only the access line.
- **Job params allowlist across the sweep:** every enqueue recorded by `FakeWorkersService` has exactly the keys `['linkId']`, with a numeric value.
- **Unique-index logging:** each unique index's duplicate answers its mapped `409` (or the shortcut's `200`) and logs nothing that contains the duplicated value (`(db)`).
- **Two-user baseline:** every DB-backed harness seeds the intruder user by default (`issues-db-harness.ts`, `issues-http-db-harness.ts`, `buildSyncWorld`, `buildLinkWorld`). This follows `testing.md`, and the existing single-user specs keep passing.
- **Edge-case coverage:**
  - Every row of `edge-cases.md` is cited by the spec that covers it. Tag the existing uncited tests (for example E6, E31, E33, E40, E48, E55 and E61).
  - Add the missing tests: E5, E9, E23, E27, E28, E30, E38, E43 and E49.
  - Leave E25 (the future "remove repository" feature) and E66 to E74 (bulk-state, #563) to their own issues, and say so in the coverage notes.
- **Review checklists:** walk the `security` and `data-access` checklists of `security.md#review-checklist` over the whole backend feature. Map each item to a Required test and close any gap.

## Out of scope

- The **frontend static spec** and the frontend rendering units of `testing.md#security-verification`. The Issues frontend does not exist yet, so these belong to #560 to #562.
- The bulk-state rows (route-matrix row, bulk weight, E66 to E74), which belong to #563.

## Acceptance criteria

- The Required tests of every spec file under *Builds against* are implemented, each on the tier given by [`testing.md`](https://github.com/darthjee/kerghan/blob/main/docs/agents/specs/issues/testing.md) (the default tier by category, and the coverage per area). The exceptions are the out-of-scope items above.
- A new Issues route without a route-matrix row fails the suite.
- No canary (credential or content) appears in any response, header, log line or job param.
- Every edge-case row is cited by a spec, or is explicitly left to #563 or the future removal feature.
- No decision differs from the specs. If one has to, the spec is updated in the same PR.
- The checks of the owning agent pass.

## Notes

Responsible agent: `backend`. Reviewed by `security`, `data-access` and `cache` (cache-class coverage of every new endpoint).

Reusable helpers:

- `core/tests/console-spies.test-support.ts`
- the `FakeLogger` mocks in the DB harnesses
- `workers/tests/support/fake-workers.service.ts` (`enqueued`, `paramsOf`)
- `repositories/tests/support/two-user-baseline.ts`
- `issues/tests/support/*` (`build-issues-test-app.ts`: `expectNeverCached`, `expectNoForbiddenKeys`)
- the `registeredRoutes()` helper of the access specs
