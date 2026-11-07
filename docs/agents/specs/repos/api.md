# Repositories — API

The HTTP surface of the Repositories module. Part of the [Repositories specs](README.md).

## Routes

Routes are named here by method and purpose; their exact contract is open (see
[Contract](#contract)).

### Listing

`GET`, paginated. Serves the user's rows **from the database**, never straight from GitHub.

- Filter: **All** (default), **Added**, **Not added**, **Unavailable**.
- Name search.
- Each row: `owner/name`, visibility, sources, status ([model.md](model.md#row-statuses)), and
  the GitHub repository id used by Add.
- Includes the sync state (`idle` / `syncing`, `last_synced_at`, per-source status).
- Starts a sync when the last one is stale ([sync.md](sync.md#trigger)).

### Sync state

`GET`. Returns the sync state only. Polled by the frontend while a sync runs.

### Refresh

`POST`. Forces a sync. Inside the cooldown it answers `429` with `Retry-After`.

### Add

`POST`, with a GitHub repository id.

- Re-checked with GitHub before anything is written ([security.md](security.md#add-verification)):
  one request for that repository, through the chosen access integration
  ([integrations.md](integrations.md#access-link-on-add)), or unauthenticated when only the
  public source sees it.
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
- No response includes a credential or anything derived from one.

## Contract

> **Open — settled by #446:** paths, request and response shapes, the pagination format, the
> filter and search parameters, status and error codes (including a duplicate Add, validation
> errors, `404`, `429` + `Retry-After`), and the polling contract, in the
> `docs/agents/backend/routes/` style.

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
- No response body contains a credential or a value derived from one.
