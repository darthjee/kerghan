# Issue: Refactor: dedupe ApiClientSpec 401-refresh scenarios and AccountsClientSpec setup

## Description
The client specs repeat the same mock-fetch/session-stub setup in almost every scenario.

## Problem
jscpd, under `frontend/specs/assets/js/client/`:

- `ApiClientSpec.js` — 15 lines across two clones (156-163 ↔ 210-217, 198-204 ↔ 217-223): the `spyOn(AuthSession, 'get'/'set'/'clear')` + `globalThis.fetch = fetchSequence([...401, refresh 200, ...])` blocks in the `401 handling` tests. Three of the four tests also end with the same "session expired" assertions (`AuthSession.clear` called, `LoginModalEvents.open('password')`, `window.location.hash` is `''`).
- `AccountsClientSpec.js` — 12 lines (56-67 ↔ 25-36). The `register`, `login` and `refresh` blocks each have a "posts to the endpoint" case and a "persists the returned refresh token" case that differ only by method, arguments, endpoint and payload.

`fetchSequence` and `fakeResponse` are currently defined inline in `ApiClientSpec.js` and used nowhere else.

## Expected Behavior
- A helper such as `stubRefreshFlow(responses)` sets up the `AuthSession` spies and `fetchSequence` once, and an `expectSessionExpired()` helper covers the repeated end-of-test assertions, so each `401 handling` test reads as its fetch sequence plus its distinct expectations.
- In `AccountsClientSpec.js`, the `register`/`login`/`refresh` "posts to the endpoint" cases and the "persists the returned refresh token" cases become table-driven (method, args, endpoint, payload).
- What each spec asserts is unchanged.

## Solution
- Move `fakeResponse`, `fetchSequence` and the new `stubRefreshFlow` (and `expectSessionExpired`, if it fits) into a shared support file under `frontend/specs/support/`, alongside `fakeWindow.js`, and import them from `ApiClientSpec.js`.
- Convert the four `401 handling` tests in `ApiClientSpec.js` to use the helpers.
- Convert the repeated `AccountsClientSpec.js` cases to table-driven `it` loops.
- `AccountsClientAuthorizationRequestsSpec.js` is out of scope: it stubs `ApiClient.postJson` and never touches `fetch` or the refresh flow, so it does not benefit from these helpers.
- The "does not touch the stored refresh token" cases in `status`/`recover`/`resetPassword`/`updateAccount` are left as they are.

## Benefits
The 401-handling scenarios become short enough to read as a state machine, making gaps in coverage easier to spot.
