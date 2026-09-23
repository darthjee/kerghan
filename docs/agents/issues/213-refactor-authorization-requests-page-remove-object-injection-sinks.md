# Issue: Refactor: Authorization-requests page: remove object-injection sinks

## Description
The authorization-requests page keeps per-row UI state (`{open, password, error}`) in a plain object keyed by request UUID. It reads and writes that state with bracket access in three places: the page component, its controller, and its render helper.

## Problem
`security/detect-object-injection` (High) at:

- `frontend/assets/js/components/resources/accounts/pages/AuthorizationRequests.jsx:46`, `:51`, `:58` (`current[uuid]`, `rowState[uuid]?.open`, `rowState[uuid]?.password`)
- `frontend/assets/js/components/resources/accounts/pages/controllers/AuthorizationRequestsController.js:110` (`{ [uuid]: { ...current[uuid], ...patch } }`)

Two more things need fixing along with these:

- `frontend/assets/js/components/resources/accounts/pages/helpers/AuthorizationRequestsHelper.jsx:88` also reads `rowState[request.uuid]`. Codacy does not list it, but once the state is a `Map` this bracket read silently returns `undefined` for every row. So it must change in the same PR.
- The row-patch logic is duplicated: the page's `patchRow` (`AuthorizationRequests.jsx:44`) and the controller's private `#patchRowState` (`AuthorizationRequestsController.js:107`) are identical.

## Expected Behavior
Opening a row, typing a password, authorizing, denying, and showing a per-row error all work exactly as they do today.

## Solution
- Store row state in a `Map<uuid, RowState>`. `INITIAL_ROW_STATE` becomes an empty `Map`. Updates clone the map: `new Map(current).set(uuid, { ...current.get(uuid), ...patch })`. Reads go through `.get(uuid)`.
- Make the patch logic live only in the controller. Turn `#patchRowState` into a public `patchRow(uuid, patch)` and have `#performRowAction` keep using it. Delete the page's own `patchRow` and route `handleToggleAuthorize` / `handlePasswordChange` through `controller.patchRow`.
- Change the page's reads (`open`, `password`) and `AuthorizationRequestsHelper#renderRow` to use `rowState.get(uuid)`, and update the JSDoc types from `object` to `Map`.
- In `AuthorizationRequestsSpec`, `AuthorizationRequestsControllerSpec` and `AuthorizationRequestsHelperSpec`, change the fixtures and expectations that build or assert on the `rowState` shape so they use `Map`s. Add a spec for the new public `patchRow`, which must keep a row's other fields when it merges a patch.

## Benefits
Removes four High Codacy findings, stops using request UUIDs as object keys, and puts the row-patch logic in a single place.

## Verification

- `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` pass, and coverage does not drop.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
