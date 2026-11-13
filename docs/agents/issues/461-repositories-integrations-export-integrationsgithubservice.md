# Issue: Repositories: Integrations — export IntegrationsGithubService

## Description

Part of Epic #444 (repositories listing), implementation slice **B**. The Integrations module starts exporting `IntegrationsGithubService`: the single, backend-only GitHub client that Repositories uses to list and re-check repos, without any credential leaving the module.

Spec: `docs/agents/specs/repos/integrations.md` (the whole file), plus `security.md#credentials-stay-in-the-backend` and `security.md#fixed-github-base-url`.

**Depends on:** nothing. It can run in parallel with #460 and #462.
**Blocks:** #463 (Repositories module).

## Problem

`backend/src/integrations/` exports nothing. The repositories sync and Add need typed, `GET`-only GitHub operations, authenticated per integration type and unauthenticated for the handle, with credentials, minted tokens and GitHub bodies never leaving the module.

## Expected Behavior

- **`IntegrationsGithubService` exported** with the fixed operations and typed results of `integrations.md#exported-service`.
- **One client for every call:** authenticated and unauthenticated calls both go through it (`#unauthenticated-calls`).
- **Endpoints and parameters per source:**
  - `GET /user/repos` for `pat` and `oauth_app`;
  - `GET /installation/repositories` for `github_app`;
  - `GET /users/{handle}/repos?type=owner` for the handle;
  - `GET /repositories/{id}` for Add;
  - listings sorted `created` ascending (`#endpoints-and-parameters`).
- **Installation-token cache:** tokens are cached in memory until `expires_at` − 5 min, single-flight, and minted with `metadata: read`. Test connection still mints fresh (`#github-app-installation-tokens`).
- **Invalidation:** `401` → `invalid`, and for `github_app` only a mint `404`/`403`. Every such status change, decrypt failures included, is a compare-and-set on `secret_iv` (`#invalid-on-401`, `#status-compare-and-set`).
- **Usable integrations:** an integration is usable when it reports `active` and its type is enabled; a missing one answers `integration_unusable` with reason `missing` (`#usable-integrations`).
- **Error mapping:** one mapping table. Rate limits are read from headers only; redirects are classified and never followed (`#error-mapping`).
- **Add:** the access-link choice and the Add candidate walk, capped at 3 GitHub calls (`#access-link-on-add`, `#add-re-check-candidates`).
- **Shared helpers:** the `502`/`503` helpers move to `core/github-http-errors.ts` (`#shared-502--503-helpers`).
- **Deletion event:** the awaited `integration.deleted` event is emitted on integration deletion (`#deletion-hook`).
- **Unauthenticated budget tracker:** internal to the client, with in-flight reservations and two thresholds, sync ≤ 10 and Add ≤ 0 (`#unauthenticated-budget-tracker`).

## Solution

Backend only, in `backend/src/integrations/` and `backend/src/core/`. Integrations is tested at the `fetch` level (`testing.md#integrations-fetch-level`), behind the no-network guard (`testing.md#no-network-guard`). Request a security review on the PR.

### Decisions

- **Typed fake ships here.** This slice ships the shared typed builders (`testing.md#shared-builders`), `FakeIntegrationsGithubService` (`testing.md#repositories-typed-fake`) and the fake-fidelity contract spec (`testing.md#fake-fidelity`), all as Integrations test support. The contract spec runs green in this PR; #463 imports the fake instead of writing it.
- **Shared `Clock` in `core/`.** This slice adds `core/clock.ts`: an injectable `Clock` (`now(): Date`) with a system implementation, plus a `FakeClock` test helper (`set(date)` / `advance(ms)`) per `testing.md`. The unauthenticated budget tracker and the installation-token cache read it, never `Date.now()`. #463 reuses the same `Clock` for Repositories (`sync.md#time-source`). If `sync.md` or `testing.md` place the `Clock` elsewhere, update them in this PR.
- **`secret_iv` compare-and-set tested at unit level here.** This slice tests the compare-and-set logic (status changes on `401`, a mint `404`/`403`, decrypt failures, a lost race leaving the row untouched) at unit level against the in-memory repository fake. The `(db)` compare-and-set specs move to #463, which already depends on #462's DB-backed tier. #461 stays free of dependencies, and this PR updates the testing split in `integrations.md#required-tests` (and `testing.md` if needed) to say so.
- **Deletion event, emitter side only.** Integrations emits the awaited `integration.deleted` event and evicts the cached installation token. The Repositories listener is #463's.

### Shared rules for this Epic's slices

- **Specs are the source of truth.** If the spec turns out to be wrong or underspecified, this PR updates `docs/agents/specs/repos/` too, and the PR description says what changed.
- This PR adds this issue's row to the "Sub-issues" table in `docs/agents/specs/repos/README.md`.
- No permanent docs (`product.md`, `modules/`, `backend/routes/`, …) change here: #452 folds them in.
- Every test this slice owns, as listed in the "Required tests" sections named below, is written and passes; tiers, fakes and harnesses follow `docs/agents/specs/repos/testing.md`. The owned sections are `integrations.md#required-tests` (except the `(db)` items moved to #463) and the Integrations items of `security.md#required-tests` (the canary sweep).

## Benefits

- Repositories gets one typed, `GET`-only GitHub client, and no credential, minted token or GitHub body ever leaves Integrations.
- The fake and the `Clock` are ready before #463 starts, and the contract spec stops the fake from drifting from the real service.
- #461 runs in parallel with #460 and #462.
