# Plan: Issues: GitHub link (import, attach, unlink)

Issue: [557-issues-github-link-import-attach-unlink.md](../../issues/557-issues-github-link-import-attach-unlink.md)

## Overview

This plan adds the GitHub link to the Issues module (`backend/src/issues/`). It has three routes:

- `POST /projects/:projectId/issues/import.json` with `{ number }`, answering `201` with the issue
- `POST /projects/:projectId/issues/:issueId/attach.json` with `{ number, confirmUpdatedAt? }`, answering `200` with the issue
- `POST /projects/:projectId/issues/:issueId/unlink.json` with `{ discardUnsentChanges? }`, answering `200` with `{ issue, droppedUnsentChanges }`

It also builds:

- one link-creation method shared by import and attach;
- the candidate resolver that picks the integration for the single GitHub read, which #558 reuses;
- the link object behind the `IssueLinkPresenter` seam that #556 left;
- a waiting-set read port, with an empty default, that #558 binds.

All routes are `POST`, use `@CachePolicy(CacheClass.UserScoped)` and `uuidParamPipe()`, and resolve access through `IssuesAccess`.

## Context

- **Specs:**
  - `docs/agents/specs/issues/github-link.md`: creating a link, the same-repository rule, unlinking, and the link states as read;
  - `api/github-link.md`: the order of checks, the GitHub failures, the attach confirmation, unlink and the link object;
  - `api/errors-and-validation.md`: the codes and the field rules;
  - `sync.md#integration-selection` and `sync.md#github-issue-client-operations`;
  - `security.md#request-rate-limits`;
  - `edge-cases.md`: E3, E4, E45 to E47 and E57 to E64.
- **Already in place from #553, #555 and #556:**
  - the `IssueGithubLink` and `IssuePendingWrite` entities, and the unique indexes on (`user_id`, `github_issue_id`) and on `issue_id`;
  - `IssuesAccess` with `{ lock }`;
  - `IssuesConfig.linkMaxPerWindow`, `linkWindowMs` and `syncStaleAfterSeconds`;
  - `IssueEditRateLimiter`, the shape to reuse;
  - `IssueStore.insert` and `update`, and `IssueMarkers.hasLink`;
  - the `IssueLinkPresenter` seam;
  - `normalizeBody` (`dto/issue-fields.ts`), `stampOf` and `duplicateEntryIndex`;
  - `issueLinked()` on delete;
  - `ProjectRepositoryChanger`, which locks the project first (E62);
  - `RepositoriesService.projectSummaries`;
  - the test support (`seedProject`, `seedIssue`, `seedLink`, `seedMarker`, `seedIntruder`, `FakeProjectRepositories`, the DB and HTTP harnesses).
- **Depends on #554, which is still open.** #554 adds `getIssue` (result kinds `ok{issue, etag, renamedTo?}`, `not_modified`, `not_found`, `gone`, `moved`, `forbidden` plus `RepoFailure`) to `IntegrationsGithubService`, re-exported through `integrations-github.public.ts`. It also extends `FakeIntegrationsGithubService` with scripted answers per operation and the builders `githubIssue` and `githubPullRequest`.
  - Do not start implementing until #554 has merged.
  - Step 01 checks the merged signatures and adjusts the names in this plan to match.
- **Decided at refinement:**
  - #557 builds the candidate resolver, and #558 adds the paused-candidate skip and the waiting sets;
  - the waiting-set state reaches the link object through a port whose default is empty;
  - the gone and `sync_failed` transitions, E22, the E1 and E44 races and the rename hand-off belong to #558;
  - a `renamedTo` hint seen during creation is ignored.

## Steps

- [01 — Check the #554 contract](backend/01-check-client-contract.md)
- [02 — Error codes and helpers](backend/02-error-codes.md)
- [03 — DTOs](backend/03-dtos.md)
- [04 — Link rate limiter](backend/04-link-rate-limiter.md)
- [05 — Candidate resolver and GitHub issue reader](backend/05-candidates-and-reader.md)
- [06 — Normalization, link store and unlink cleanup](backend/06-normalization-and-link-store.md)
- [07 — Link object presenter and waiting-set port](backend/07-link-presenter.md)
- [08 — IssueLinksService and controller](backend/08-service-and-controller.md)
- [09 — Tests](backend/09-tests.md)

## CI Checks

Run everything through `docker-compose`, never on the host:

- `backend`: `yarn test` / `yarn coverage` (CI job: `backend_tests`)
- `backend`: `yarn test:db` against MySQL (CI job: `backend_db_tests`)
- `backend`: `yarn lint` (CI job: `backend_checks`). This includes the Issues ESLint boundary: Issues imports Integrations only through `integrations-github.public` and Repositories only through `RepositoriesService` and `repositories.public`.

## Notes

- **Reviews:**
  - the `cache` agent reviews the cache class (`user-scoped`, `X-Skip-Cache`, nothing in Navi);
  - the `security` and `data-access` agents review against `docs/agents/specs/issues/security.md#review-checklist`. This change adds outbound GitHub reads with the owner's credential and new response fields.
- **Lock order:** projects, issues, links, markers.
  - Link creation reads GitHub **before** opening the transaction, and no lock is held across the network call.
  - Inside the transaction it locks the project, then (on attach) the issue.
  - Unlink locks the project, then the issue, then the link, then the marker.
- **Timestamps:**
  - `issues.updated_at` takes the full-millisecond `Clock` instant;
  - the link's `datetime` columns (`created_at`, `updated_at`, `last_synced_at`) use `stampOf`;
  - `github_updated_at` comes from GitHub's answer, truncated to whole seconds.
- **Logs:** link ids, issue ids and integration ids only. Never titles, bodies, GitHub error bodies or tokens.
- **Seams left for #558:**
  - `IssueRateLimitWaits`, a waiting-set read with an empty default;
  - `IssueCandidates`, for reuse with the paused skip.
  - Each gets a doc comment naming #558.
- **Out of scope:**
  - the gone, moved and `sync_failed` transitions on refresh and push, the E22 probe, the E1 and E44 races, the rename hand-off (E65) and T2 to T4 (all #558);
  - the client itself (#554);
  - bulk import;
  - the #559 matrix;
  - the UI.
