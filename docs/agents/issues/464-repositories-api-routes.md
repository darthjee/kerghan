# Issue: Repositories: API routes

## Description

Part of Epic #444 (repositories listing), implementation slice **E**. It exposes the **Repositories API**: the listing, sync state, Refresh and Add routes, on top of D's module.

Spec:
- `docs/agents/specs/repos/api.md` (the whole file);
- `security.md#user-scoping`, `#add-verification`, `#csrf`, `#errors-and-logging`, `#abuse-and-performance` and `#module-boundaries`;
- `testing.md#access-control-and-leaks`, `#module-boundaries` and `#cache`.

**Depends on:** #463 (Repositories module).
**Blocks:** #466 (Repositories page).

## Problem

The sync engine and tables exist, but the frontend cannot reach them. The routes must be user-scoped, never expose the internal id, never call GitHub straight from the listing, and leak no credential.

## Expected Behavior

- **Routes:** every route is `POST`, with `JwtGuard`, `OriginGuard` and cache class `user-scoped`, and is never warmed by Navi (`api.md#every-route`, `#routes`):
  - `POST /repositories/mine.json`: the paginated, filterable listing, served from the DB, with the `sync` object. It starts a sync when stale (`#listing`, `#stale-sync-trigger`).
  - `POST /repositories/sync/state.json`: sync state and the polling contract. It never starts a sync (`#sync-state`, `#polling-contract`).
  - `POST /repositories/sync.json`: Refresh, `202` or `429 REPOSITORY_REFRESH_COOLDOWN` (`#refresh`).
  - `POST /repositories/add.json`: Add, following the six steps of `api.md#add`:
    - it takes a repo ref, `{ githubId }` or `{ fullName }`, validated by the DTO;
    - it is rate limited per user (`#add-rate-limit`), before the lookup;
    - it looks the ref up among the caller's own rows (`RepositoriesService#findByRef`) and answers `200` with no GitHub call when the row is already added;
    - it re-checks the repo with GitHub through the candidate walk (`walkAddCandidates` + `IntegrationsGithubService#getRepository`), at most 3 calls, and maps the walk's outcome to `404`, `409 REPOSITORY_SOURCE_UNUSABLE`, `502` or `503`;
    - it writes through `RepositoriesService#markAdded`, which is idempotent (`already_added` answers `200`, `gone` answers `404`).
- **Errors:** as in `api.md#errors`, including `429` with `Retry-After` and the optional `error.retryAfterSeconds` body field. New codes are added to `core/error-codes.ts`; `502`/`503` reuse `core/github-http-errors.ts`.
- **Access:** another user's repo answers `404`, like a missing one, and admins get no access (`api.md#access`).
- **Thin controller:** the controller validates, calls one service method and shapes the response.
- **ESLint boundary:** an override on `backend/src/repositories/**`, plus a static boundary spec (`security.md#module-boundaries`, `testing.md#module-boundaries`).
- **Tests:**
  - `api.md#required-tests` (the `(db)` race items already covered by #463 are not rewritten);
  - the route access matrix with its completeness check;
  - the credential canary sweep over responses, headers and logs;
  - an intruder user in every harness;
  - the cache-policy coverage spec, which asserts these routes' class. `navi/` is unchanged.

## Solution

Backend, in `backend/src/repositories/` (controller, DTOs, Add service, rate limiter) and `backend/src/core/` (error codes), plus `backend/eslint.config.*` and `docs/agents/environment-variables.md`. Request security, data-access and cache reviews on the PR.

### Decisions

- **The data layer is #463's, already merged.** `RepositoriesService` provides `list`, `syncState`, `triggerIfStale`, `refresh`, `reconcileForRequest`, `findByRef` (with the `fullName` tie-break: latest `last_seen_at`, then highest `id`) and `markAdded`. #464 uses them and does not reimplement them.
- **Add orchestration lives in a service, not the controller.** A new `RepositoryAddService` (in `backend/src/repositories/`) runs the steps of `api.md#add`: rate limit → `reconcileForRequest` → `findByRef` → already-added shortcut → candidate walk → `markAdded`. It returns a typed outcome, and the controller maps it to HTTP. The re-check is built from the stored row's `githubId`, never from the request's `fullName`.
- **The Add rate limit is in memory.** It is a per-process, per-user fixed window, read through the shared `Clock` and configured with `getNumberConfig` (`KERGHAN_REPOSITORIES_ADD_MAX_PER_WINDOW` = 30, `KERGHAN_REPOSITORIES_ADD_WINDOW_MS` = 60000). There is no table and no migration. It resets on restart, and each instance counts on its own. This PR updates `api.md#add-rate-limit` to say so: it no longer says the limit follows the DB-backed auth abuse guards. Stale entries are dropped so the map cannot grow without bound.
- **Env vars are documented here.** This is an explicit exception to the shared "no permanent docs" rule, because operators need the vars as soon as the code reads them. `docs/agents/environment-variables.md` gets the two Add vars and #463's sync vars (`KERGHAN_REPOSITORIES_SYNC_TTL_MS`, `_COOLDOWN_MS`, `_PAGE_CAP`, and any other `KERGHAN_REPOSITORIES_*` var read in `repositories-config.ts`).

### Shared rules for this Epic's slices

- **Specs are the source of truth.** If the spec turns out to be wrong or underspecified, this PR updates `docs/agents/specs/repos/` too, and the PR description says what changed.
- This PR adds this issue's row to the "Sub-issues" table in `docs/agents/specs/repos/README.md`.
- No permanent docs (`product.md`, `modules/`, `backend/routes/`, …) change here, apart from the env-var exception above: #452 folds them in.
- Every test this slice owns, as listed in the "Required tests" sections named below, is written and passes; tiers, fakes and harnesses follow `docs/agents/specs/repos/testing.md`. The owned sections are `api.md#required-tests`, `sync.md#required-tests`'s Add rate-limit window, the HTTP half of `security.md#required-tests` (route access matrix, canary sweep, "User scoping" for routes), and `testing.md#access-control-and-leaks`, `#module-boundaries` and `#cache`.
