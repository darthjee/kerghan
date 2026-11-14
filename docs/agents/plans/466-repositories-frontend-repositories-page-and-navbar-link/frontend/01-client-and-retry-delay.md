# 01 — Client and retry delay

Add the HTTP client for the four Repositories routes, and expose the body's retry delay on `ApiError`.

- `RepositoriesClient` (object module, like `IntegrationsClient`), each method a `POST` through `ApiClient.postJson`, resolving `undefined` on an expired session and rejecting with `ApiError` otherwise:
  - `list({ page, perPage, filter, search })` → `POST /repositories/mine.json`, body built with `pickDefined` (omit undefined fields; an empty search may be omitted);
  - `syncState()` → `POST /repositories/sync/state.json`, `{}`;
  - `refresh()` → `POST /repositories/sync.json`, `{}` (the `202` is `ok`);
  - `add(githubId)` → `POST /repositories/add.json`, `{ githubId }`.
- `ApiError` gains a sixth constructor argument and field, `retryAfterSeconds`. `buildApiError` sets it from `data.error.retryAfterSeconds` when it is a non-negative integer, falling back to `parseRetryAfter(response)`. The existing `retryAfter` (header only) is unchanged, so Integrations keeps working.
- Shared builders in `specs/support/repositoriesBuilders.js`: `buildRepository`, `buildSyncState` and `buildSource`, mirroring `api.md#listing` / `#sync-state` shapes (defaults: a public, not-added `darthjee/kerghan` row; an idle sync state with `lastSyncedAt` set and `refreshAvailableAt: null`; an `ok` integration source `work-pat`). Plus a `buildListing({ repositories, pagination, sync })`. Each needs its own small spec (house rule: support files have specs, e.g. `fetchSequenceSpec.js`).

## Files to Change
- `frontend/assets/js/client/RepositoriesClient.js` — new.
- `frontend/assets/js/client/ApiError.js` — `retryAfterSeconds` field + JSDoc.
- `frontend/assets/js/client/ApiClient.js` — `buildApiError` reads the body field with the header fallback.
- `frontend/specs/assets/js/client/RepositoriesClientSpec.js` — new, with `fetchSequence`: method, URL, body for each route; `ApiError` mapping for `400`, `404`, `409 REPOSITORY_SOURCE_UNUSABLE`, `429` (body `retryAfterSeconds` and header-only fallback), `502`, `503`.
- `frontend/specs/assets/js/client/ApiErrorSpec.js`, `ApiClientSpec.js` — the new field and precedence (body wins over header; header used when body has none; invalid values ignored).
- `frontend/specs/support/repositoriesBuilders.js` + `repositoriesBuildersSpec.js` — new.
