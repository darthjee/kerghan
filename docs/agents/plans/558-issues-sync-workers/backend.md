# Backend Plan: Issues: sync workers

Main plan: [plan.md](plan.md)

## Overview

Implement the sync exactly as specified. The specs are the source of truth: `sync.md` (all of it), `api/github-link.md#trigger-routes`, `model.md` (marker lifecycle), `edge-cases.md` (E1, E2, E6 to E11, E13 to E24, E44, E65) and `testing.md` (tiers, worker tests, races). If a decision has to differ, update the spec in the same PR.

## Context

Already on `main` (paths under `backend/src/`):

- **Ports with default bindings** in `issues/issues.module.ts` (`ISSUES_PROVIDERS`):
  - `IssueSyncTrigger` / `NoopIssueSyncTrigger` (`issues/issue-sync-trigger.ts`), called by `IssuesService#afterCommit` after an edit commits.
  - `IssueRateLimitWaits` / `EmptyIssueRateLimitWaits` (`issues/issue-rate-limit-waits.ts`), read by `IssueLinkPresenter`.
- **`IssueCandidates.resolve(userId, repositoryId)`**: the ordered candidate ids, or `none` with `no_credential` / `credential_invalid`. `IssueGithubReader` is the pattern for a candidate walk, but it maps `gone`/`moved` to `not_found` and has no probe, so the reconcile needs its own walk.
- **Integrations surface:**
  - `IntegrationsGithubService.getIssue(..., etag)` and `probeIssues`.
  - `IntegrationsGithubIssueWriter.updateIssue`. It throws on an empty diff, so never call it with one.
  - Result unions in `integrations/github-issue-results.ts`. A rename arrives as `renamedTo`; an unclassifiable `301` is `unavailable{reason:'redirect'}`; a `401` already marks PAT and OAuth integrations `invalid`.
- **Config:** `IssuesConfig` already reads `syncMaxRetries`, `syncCooldownMs` and `syncStaleAfterSeconds`.
- **Clock:** `Clock` / `FakeClock` exist.
- **Stale flag:** already derived in `linkResponse`.
- **Workers:** `WorkersService.register/enqueue` exists, and no job exists yet.

Missing, built here:

- **Test doubles and scheduling:** a scheduler abstraction and its fake, and `FakeWorkersService`.
- **Cross-module pieces:** an exported user-approval check in Auth, a Repositories method that persists a rename, and the `ISSUE_LINK_GONE` error.
- **Job and store support:** the `maxRetries`/`cooldown` getters in the deku-swarm typings, and the compare-and-clear, boot listing and gone discard in `IssueMarkers`.
- **Wiring:** `IssuesModule` does not import `WorkersModule` yet.

## Steps

- [01 — Test doubles and cross-module prerequisites](backend/01-prerequisites.md)
- [02 — Marker and link store operations](backend/02-marker-and-link-stores.md)
- [03 — Rate-limit pauses, waiting sets and timers](backend/03-rate-limit-waits.md)
- [04 — The reconcile in the issues sync service](backend/04-reconcile-service.md)
- [05 — The `issues.reconcile` job, dedupe and triggers T1, T5, T6](backend/05-job-and-triggers.md)
- [06 — Trigger routes T2, T3, T4](backend/06-trigger-routes.md)
- [07 — Engine, race and restart specs](backend/07-engine-race-restart-specs.md)
- [08 — Docs and boundary specs](backend/08-docs-and-boundaries.md)

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `make db-tests`, which runs `yarn test:db` in `kerghan_db_tests` (CI DB job)

## Notes

- **Reviews:**
  - Routes: the `cache` agent checks the cache class (`@CachePolicy(CacheClass.UserScoped)`, `X-Skip-Cache`, nothing in Navi).
  - Routes and the job: the `security` and `data-access` agents run the checklists of `docs/agents/specs/issues/security.md#review-checklist`. The job runs with the owner's credential, so `security` reviews it too.
- **Job params** are `{ linkId }` only. Logs carry `jobId`, `linkId`, the outcome kind and the error class only: never a title, body, owner/name, URL, header or credential.
- **Environment:** `deku-swarm` seemed missing from the test container's `node_modules`. If the `(engine)` specs cannot load it, run `yarn install` inside the container, never on the host. A stale `kerghan_mysql` container name conflict was seen and left alone.
- **T3 ordering:** "never-synced first" cannot happen in practice, because link creation sets `last_synced_at`. Order with NULL first anyway, consistent with the presenter's fallback.
- **Race specs** use the fake's `hold()` deferreds, never polling loops. `race-helpers.until` stays limited to lock waits.
