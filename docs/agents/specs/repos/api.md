# Repositories — API

The HTTP surface of the Repositories module. Part of the [Repositories specs](README.md).

## Routes

Routes are named here by method and purpose; their exact contract is open (see
[Contract](#contract)).

### Listing

`GET`, paginated. Serves the user's rows **from the database**, never straight from GitHub.

- Filter: **All** (default), **Added**, **Not added**, **Unavailable**. **Unknown** rows show
  only under All, on purpose: the filter list is the one fixed by #444.
- Name search.
- Each row: `owner/name`, visibility, sources, status ([model.md](model.md#row-statuses)), and
  the GitHub repository id used by Add.
- Includes the sync state (`idle` / `syncing`, `last_synced_at`, per-source status).
- Starts a sync when the last one is stale ([sync.md](sync.md#trigger)).

> **Open — settled by #446:** whether the stale-sync trigger stays a side effect of this `GET` —
> then recorded as a justified exception to the "no state change over `GET`" rule
> ([architecture/security.md](../../architecture/security.md#rules-for-future-changes)), which
> #452 folds there — or becomes a separate `POST` covered by `OriginGuard`.

### Sync state

`GET`. Returns the sync state only. Polled by the frontend while a sync runs.

### Refresh

`POST`. Forces a sync. Inside the cooldown it answers `429` with `Retry-After`.

### Add

`POST`, with a GitHub repository id.

- **Owner lookup first:** the row is looked up by (`user_id` from the session, `github_id`) in the
  query itself, before any cooldown check or GitHub call. A missing row, including one that only
  another user holds, answers the same `404` as a GitHub denial, with no GitHub call and no
  write. Only repos already in the user's own listing can be added.
- Re-checked with GitHub before anything is written ([security.md](security.md#add-verification)):
  one request for that repository, through the chosen access integration
  ([integrations.md](integrations.md#access-link-on-add)). When only the public source sees it,
  the re-check goes through a valid integration if the user has one (without linking it), and
  unauthenticated otherwise.
- The unauthenticated re-check honours the same low-budget threshold as the sync
  ([sync.md](sync.md#rate-limits)): when the budget is low it answers a transient "rate limited"
  error, never `404`, and marks nothing `invalid`.
- Add is rate limited per user, following the abuse-guard services in `backend/src/auth/`.
- On success: refreshes the snapshot, sets `added_at` and `integration_id`.
- A repository the user cannot see answers `404`.

## Every route

- Requires `JwtGuard`.
- Uses the `.json` URL suffix convention.
- Cache class **`user-scoped`** ([caching.md](../../architecture/caching.md#cache-classes)), so
  it sends `X-Skip-Cache` and is never warmed by Navi.
- State-changing routes (Refresh, Add) are `POST`, covered by `OriginGuard`
  ([security.md](security.md#csrf)).
- Controllers stay thin; the logic lives in the module's services.

## Access

- Every query is scoped to the session's user.
- Another user's repository, or a repository the user cannot see, answers `404` like a missing
  one.
- Admins have no access to anyone's repositories (same rule as integrations).
- No response includes credential material (secrets, tokens, GitHub App installation tokens) or
  anything computed from it ([security.md](security.md#credentials-stay-in-the-backend)).
- **Exposed identifiers:** no response includes `user_id` or an internal `integrations.id`.
  Integrations are referenced only by their `uuid` and/or label, and only the caller's own. Repo
  responses carry no other integration field (no `secretHint`, `github_login`, `status_reason`
  or metadata).

## Contract

> **Open — settled by #446:** paths, request and response shapes, the pagination format, the
> filter and search parameters, status and error codes (including a duplicate Add, validation
> errors, `404`, `429` + `Retry-After`, the Add "rate limited" error), the polling contract,
> whether a repository's own internal `id` is exposed or only `github_id`, and the Add rate-limit
> values, in the `docs/agents/backend/routes/` style.

## Required tests

Tests for the open points above are added by the issue that settles them.

- Every route answers `401` without a session.
- Every route declares the `user-scoped` cache class and sends `X-Skip-Cache`.
- The listing never calls GitHub synchronously; it reads from the database.
- A user never sees, adds or refreshes another user's repositories; another user's repository
  answers `404`.
- An admin has no access to another user's repositories.
- Refresh and Add are `POST` and rejected by `OriginGuard` from a foreign origin.
- Add re-checks with GitHub: a repository GitHub does not grant answers `404` and writes nothing.
- Add with a `github_id` not in the caller's own rows (absent, or held only by another user)
  answers `404` without any GitHub call.
- The unauthenticated Add re-check on a low budget answers "rate limited", not `404`.
- Repeated Adds hit the per-user Add rate limit.
- No response body contains credential material, `user_id`, an internal `integrations.id`,
  `secretHint` or `github_login`.
- The listing filter accepts no Unknown value; Unknown rows appear under All.
