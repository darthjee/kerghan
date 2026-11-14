# 03 — Repositories controller

`RepositoriesController` owns every state change and side effect; the page passes it React setters, like `IntegrationsController`. Split it into collaborators as the lint size limits require (for example `RepositoriesPoller`, `RefreshCountdown`, `AddStateStore`, `bannerDismissals`, `addErrorMessages`).

State the page holds (names are a suggestion): `listing` (`repositories`, `pagination`), `sync` (the sync-state object), `query` (`page`, `filter` default `all`, `search`), `loadState`, `addState` (a `Map` keyed by `githubId`: `{ status: 'pending' | 'error', message, link? }` plus an `addedIds` set for the optimistic Added rows), `dismissed` (a `Set` of `source-key|status|syncedAt`), `refreshNotice`, `now` (for the countdown/"ago" labels).

Behaviour (each with its spec):
- **Load** `list(query)`. Stores `repositories`, `pagination` and `sync`. Starts polling when `sync.state === 'syncing'`.
- **Filter / search / page** changes update `query` and reload. A filter change or a reload clears the optimistic Added rows; navigation away (unmount) clears Add state.
- **Empty-page jump:** a reload returning no items on `page > 1` with `total > 0` sets the page to `totalPages` and reloads **once** (no loop).
- **Polling:** every **2000 ms** (`POLL_INTERVAL_MS` constant) call `syncState()` while `syncing`. On `idle`: stop, store the state, reload the current page. On unmount (`dispose()`): stop. On `401` (the client resolves `undefined`): stop. On a network error or `5xx`: keep polling. Rows are **not** touched by a poll, only `sync`.
- **Refresh:** `refresh()`. A `202` stores the returned sync state and starts polling. A `429` sets the notice "Repositories were synced recently. Try again in N s." with N = `retryAfterSeconds`, and the countdown's target becomes `now + N s`.
- **Countdown:** while `refreshAvailableAt` (or the adopted `429` target) is in the future, a 1 s ticker updates `now`; it stops at zero and on dispose. The format helper renders "2m 34s" (and "45s" under a minute).
- **Add:** `add(githubId)` sets `pending`. Success: removes the Add state and marks the row Added in place (status `added`, from the response), keeping it visible under "Not added" until the next reload or filter change. Failure: the inline error from the `ui.md#table` table — `404`, `502`/`503`, `409 REPOSITORY_SOURCE_UNUSABLE` (with the `#/account/integrations` link), `429` with N from `retryAfterSeconds`; any other error shows `error.message`. Add state survives a reload because it is keyed by `githubId`.
- **Banner dismissal:** `dismiss(source)` adds `key|status|syncedAt`; a banner whose triple is in the set is hidden, so a new `syncedAt` brings it back. Memory only.
- **Source key** matching row `sources[]` to sync `sources[]`: `integration:<uuid>` or `handle:<handle>`.

## Files to Change
- `frontend/assets/js/components/resources/repositories/pages/controllers/RepositoriesController.js` — new.
- `frontend/assets/js/components/resources/repositories/pages/repositories/*.js` — new collaborators (poller, countdown, Add errors, source keys, formatters such as "last synced X ago" and the countdown text).
- `frontend/assets/js/components/resources/repositories/pages/repositories/RepositoriesHandlers.js` — new, binds controller methods to UI events.
- `frontend/specs/support/repositoriesControllerHarness.js` + its spec — new: fixed `NOW`, setter spies applying values/updaters to `context.state`, a spied `RepositoriesClient`, `jasmine.clock()`, `flushMicrotasks`.
- `frontend/specs/assets/js/components/resources/repositories/pages/controllers/RepositoriesController*Spec.js` — load and query changes, polling (2 s, stop on idle/unmount/401, keep on transient error, reload on idle, rows frozen while syncing), Refresh and countdown (incl. `429` adoption), Add (spinner, success, each error, state kept across reload, Added under "Not added"), the empty-page jump, banner dismissal.
- Specs for each collaborator under `specs/assets/js/components/resources/repositories/pages/repositories/`.
