# Frontend Plan: Refactor: dedupe ApiClientSpec 401-refresh scenarios and AccountsClientSpec setup

Main plan: [plan.md](plan.md)

## Overview
Remove the jscpd clones in `frontend/specs/assets/js/client/ApiClientSpec.js` (15 lines) and `AccountsClientSpec.js` (12 lines) without changing what either spec asserts.

## Context
- `fakeResponse` and `fetchSequence` are defined inline at the top of `ApiClientSpec.js` and used only there.
- The four `401 handling` tests repeat the `spyOn(AuthSession, 'get'/'set'/'clear')` + `globalThis.fetch = fetchSequence([...])` setup; three of them (failed refresh, missing refresh token, second 401 after refresh) also end with the same "session expired" assertions: `AuthSession.clear` called, `LoginModalEvents.open` called with `'password'`, `window.location.hash` equal to `''`.
- In `AccountsClientSpec.js`, `.register`, `.login` and `.refresh` each have a "posts to the endpoint" case and a "persists the … refresh token and resolves with the response" case that differ only by method, arguments, endpoint and payload.
- `AccountsClientAuthorizationRequestsSpec.js` never touches `fetch` or the refresh flow, and the "does not touch the stored refresh token" cases in `.status`/`.recover`/`.resetPassword`/`.updateAccount` are deliberately left as they are (decided in the issue discussion).
- Decisions from the discussion: helpers go in a **shared support file** under `frontend/specs/support/` (next to `fakeWindow.js`), and both the setup and the end-of-test "session expired" assertions are extracted.

## Steps

- [01 — Extract shared fetch/refresh helpers](frontend/01-extract-shared-fetch-helpers.md)
- [02 — Use the helpers in ApiClientSpec](frontend/02-use-helpers-in-apiclientspec.md)
- [03 — Table-drive AccountsClientSpec](frontend/03-table-drive-accountsclientspec.md)

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`, `npm run lint`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: `jasmine`, `npm run coverage`)

## Notes
- Per the project boundaries, run yarn/npm only through `docker-compose` (service `kerghan_fe`), never on the host.
- The jasmine glob is `specs/**/*[sS]pec.js`, so a support module named `fetchSequence.js` (no `Spec` suffix) is not picked up as a spec. `eslint` runs over `specs`, so the new helpers need JSDoc like the neighbouring support files (`eslint-plugin-jsdoc`), and the existing `security/detect-object-injection` disable comment must travel with `fetchSequence`.
- Support helpers that contain logic have their own spec in this folder (`fakeWindowSpec.js`, `renderCapturingHandlersSpec.js`); add a small spec for the new module if the coverage job or Codacy flags it, otherwise the `ApiClientSpec` usage is sufficient.
- `expectSessionExpired()` depends on the `LoginModalEvents.open` spy installed in `ApiClientSpec`'s `beforeEach`; keep it in the shared file only if it can take that dependency cleanly (e.g. import `LoginModalEvents`/`AuthSession` and assert on the existing spies), otherwise keep it as a local helper in `ApiClientSpec.js` — the issue allows either, as long as the duplication goes away.
- The line references in the issue (e.g. `AccountsClientSpec.js` 56-67 ↔ 25-36) may be stale; re-run jscpd or compare by content, not by line number.
