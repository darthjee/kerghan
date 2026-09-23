# Frontend Plan: Refactor: Authorization-requests page: remove object-injection sinks

Main plan: [plan.md](plan.md)

## Overview
Replace the `rowState` plain object (keyed by request UUID) with a `Map<uuid, {open, password, error}>`, which removes the `security/detect-object-injection` findings. The row-patch logic lives only in the controller's new public `patchRow(uuid, patch)`. The page and the render helper read rows with `rowState.get(uuid)`. Behavior does not change.

## Context
- Codacy flags `AuthorizationRequests.jsx:46/51/58` and `AuthorizationRequestsController.js:110`.
- `AuthorizationRequestsHelper.jsx:88` (`rowState[request.uuid] ?? {}`) is not flagged, but it must switch to `.get()` in the same change. Otherwise every row renders as closed.
- The page's `patchRow` and the controller's `#patchRowState` are identical. The user chose to consolidate them into the controller.

## Steps

- [01 — Controller: Map-based public patchRow](frontend/01-controller-map-patch-row.md)
- [02 — Page: Map initial state and delegate patches to the controller](frontend/02-page-map-state.md)
- [03 — Helper: read rows from the Map](frontend/03-helper-map-read.md)

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` (CI jobs: `frontend-checks`, `jasmine`)

## Notes
- The row-state updater must return a **new** `Map` (`new Map(current).set(...)`) so React sees a new reference and re-renders. Never mutate `current`.
- `INITIAL_ROW_STATE` becomes a module-level `new Map()`. Sharing it is safe because it is never mutated, only cloned.
- Jasmine's `toEqual` compares `Map` contents, so spec expectations can be written as `new Map([['req-uuid', {...}]])`.
