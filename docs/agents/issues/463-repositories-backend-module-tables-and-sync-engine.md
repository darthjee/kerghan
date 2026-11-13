# Issue: Repositories: backend module, tables and sync engine

## Description

Part of Epic #444 (repositories listing), implementation slice **D**. It creates the **Repositories backend module**: its five tables and the asynchronous, in-process **sync engine** that fills them from every source the user has (each usable integration, plus the GitHub handle's public repos). There are no HTTP routes yet; those are E.

Spec:
- `docs/agents/specs/repos/model.md` (except `#github-handle`, which is A);
- `docs/agents/specs/repos/sync.md` (the whole file);
- `docs/agents/specs/repos/edge-cases.md` (the cases owned by the model and sync);
- `security.md#user-scoping`, `#private-metadata-lifecycle` and `#module-boundaries`.

**Depends on:** #460 (`AccountHandleService`), #461 (`IntegrationsGithubService`, `integration.deleted`), #462 (DB-backed test tier).
**Blocks:** #464 (API routes).

## Problem

There is no repository entity and nothing that syncs a user's GitHub repos. The API (E) and the page (G) need a per-user snapshot of every repo seen, with source and sync state, kept consistent under concurrency, restarts and partial failures.

## Expected Behavior

- **Tables** (`model.md#tables`), with their migrations, columns, indexes and `source_key`:
  - `repositories`, holding every repo seen, with a nullable `added_at`;
  - `repositories_sources`;
  - `repositories_source_pages`;
  - `repositories_sync_states`;
  - `repositories_source_statuses`.
- **Logical foreign keys only** to `auth_users` and `integrations` (`model.md#logical-foreign-keys`).
- **Row statuses:** Added, Not added, Unavailable and Unknown. `pending` counts as not ok, and `page_cap_reached` counts as ok (`model.md#row-statuses`).
- **Sync engine** (`sync.md`):
  - **Sources:** the handle credential, with status `not_found` on a `404`.
  - **Trigger:** stale after TTL, or Refresh, with a cooldown.
  - **Execution:** a detached promise through an injected `SyncLauncher`, with no queue.
  - **Per-user lock:** an atomic conditional `UPDATE`.
  - **Time:** an injected `Clock`, never `NOW()` in SQL time conditions.
  - **Lease recovery:** a heartbeat per page, a 2 min lease, `run_id`-guarded writes and a 5 min hard deadline.
  - **Pagination and ETags:** page-number pagination with stored ETags, the last stored page requested without `If-None-Match`, and one transaction per page.
  - **Partial failures:** reported per source.
  - **Pruning:** orphans are pruned (`model.md#private-metadata-lifecycle`), and rows past the page cap are trimmed.
  - **Link fill:** at the end of a sync, an empty or dangling access link is filled.
  - **Handle changes:** reconciled lazily, with a running sync guarded by the handle it started with.
  - **Sync-state row:** a sync run never creates it.
  - **Values:** read from env (`KERGHAN_REPOSITORIES_SYNC_TTL_MS`, `_COOLDOWN_MS`, `_PAGE_CAP`, see `sync.md#values`).
- **Listeners:**
  - `integration.deleted`: cleanup, with an end-of-sync safety net;
  - `user.deleted` (`UserDeletedEvent { userId }`): deletes the user's rows in all five tables. Auth has no deletion path yet, so only the listener is built here.

- **Service API for E** (#464), as typed service methods with no HTTP types:
  - the listing read: filters, search, sort and pagination as in `api.md#listing`, with each row's derived status;
  - the sync-state read, including `pending` for a current source with no status row;
  - the stale trigger and the Refresh trigger, returning the claim outcome (started, running, or cooldown with its `last_started_at`);
  - the handle reconciliation for request entry points, which creates the sync-state row only for an existing user;
  - the repo lookup by `githubId` or `fullName`, user-scoped, with the `fullName` tie-break on the latest `last_seen_at`, then the highest `id`;
  - Add's persistence: the conditional `UPDATE … WHERE id = :id AND user_id = :userId AND added_at IS NULL` that sets `added_at` and the link.

## Solution

Backend only:
- a new `backend/src/repositories/` module;
- the small Auth export change below;
- one `(db)` spec for Integrations.

Repositories holds no HTTP code. Every GitHub call goes through B's service, which specs replace with the typed `FakeIntegrationsGithubService` (`integrations/tests/support/`, see `testing.md#repositories-typed-fake`). The DB tier (C, `*.db-spec.ts`) covers:
- claims, unique keys and transactions;
- compare-and-set and conditional writes;
- pruning, deletion and migrations;
- the race tests (`testing.md#concurrency-and-races`).

The detached run uses the shared `FakeClock` (`core/tests/support/fake-clock.ts`) and a `CapturingLauncher` (`testing.md#detached-sync-and-time`). If this slice is too large for one PR, the planner may stage it in commits; it stays one sub-issue. Request a security review and a data-access review on the PR.

### Decisions

- **The data layer is here; HTTP is #464's.** This slice ships every query and write the routes need, as typed service methods (see Service API above). #464 adds only:
  - the controller and DTOs;
  - Add's GitHub re-check orchestration (`walkAddCandidates`);
  - the Add rate limit;
  - response shaping and the ESLint boundary.

  The row-status derivation and its tests live here (`model.md#required-tests`).
- **"User still exists" in the same transaction.** Auth's export gains an optional `EntityManager` argument, so its read joins Repositories' transaction:
  - `AccountHandleService#getGithubHandle(userId, manager?)`, or a sibling `userExists(userId, manager)`; the planner picks one.
  - Auth still owns the query (`manager.getRepository(User)`). It reads the user row with `SELECT … FOR SHARE`, so a concurrent user delete waits for the sync-state row's insert to commit, and its `user.deleted` listener then removes that row.
  - Repositories never queries `auth_users` itself.
  - `model.md#auth-export` and `#user-deletion` are updated in this PR to say so.
- **`UserDeletedEvent` lives in Auth.** `auth/events/user-deleted.event.ts` (`USER_DELETED`, `UserDeletedEvent { userId }`) is the emitter's contract, exported by Auth and unused by Auth until a deletion path exists. Repositories only listens.
- **Integrations' `(db)` compare-and-set moves here from #461.** It is the SQL `secret_iv` compare-and-set of the status writes (`integrations.md#required-tests`, "Status compare-and-set"), run as a `*.db-spec.ts`.
- **The `integration.deleted` listener is here**, including the delete-before-any-Repositories-request case (the listener is registered at boot, `integrations.md#required-tests`, "Deletion hook").
- **Handle reconciliation** is built here, both at a run's start and as a method for request entry points. #464's routes call it.

### Shared rules for this Epic's slices

- **Specs are the source of truth.** If the spec turns out to be wrong or underspecified, this PR updates `docs/agents/specs/repos/` too, and the PR description says what changed.
- This PR adds this issue's row to the "Sub-issues" table in `docs/agents/specs/repos/README.md`.
- No permanent docs (`product.md`, `modules/`, `backend/routes/`, …) change here: #452 folds them in.
- Every test this slice owns is written and passes. Tiers, fakes and harnesses follow `docs/agents/specs/repos/testing.md`. The owned tests are:
  - `model.md#required-tests`, except "GitHub handle" (#460's);
  - `sync.md#required-tests`, except the Add rate-limit window under "Time source" (#464's);
  - `edge-cases.md#required-tests`;
  - from `integrations.md#required-tests`, the `(db)` compare-and-set and the listener-at-boot deletion case;
  - the sync half of `security.md#required-tests`, "User scoping": with the two-user baseline, no sync, listener or reconciliation reads or changes the intruder's rows. The route half is #464's.
