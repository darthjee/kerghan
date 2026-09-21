# Frontend Plan: Refactor: dedupe repeated test setup in frontend controller specs (AdminUsers, Register, AuthorizationRequests)

Main plan: [plan.md](plan.md)

## Overview
Remove the near-identical setup and repeated cases inside three Jasmine controller specs under `frontend/specs/assets/js/components/resources/`. All helpers stay local to each spec file; the existing `frontend/specs/support/fakeWindow.js` is reused for the fake `window`. No shared support module is added unless an identical helper turns up in two files.

## Context
jscpd flagged repeated blocks in these specs (line numbers in the original report are stale after #172/#173):

- `AdminUsersControllerSpec.js` — the 403 case (build controller, `installFakeWindow`, act, assert redirect to `/` and that a state setter was untouched) is written out three times (`#handleSearch`, `#handleGenerateLink`, `#handleSendEmail`); every case also repeats `new AdminUsersController(setUsers, setRowResults, setSearchError, client)`.
- `RegisterControllerSpec.js` — the two success cases under `#handleSubmit` share setup, and every `#validate` case repeats `new RegisterController(...)` with a one-field override.
- `AuthorizationRequestsControllerSpec.js` — `#authorize` and `#deny` contain the same three cases (success / 400 / expired session).

## Steps

- [01 — Dedupe AdminUsersControllerSpec](frontend/01-dedupe-admin-users-controller-spec.md)
- [02 — Dedupe RegisterControllerSpec](frontend/02-dedupe-register-controller-spec.md)
- [03 — Dedupe AuthorizationRequestsControllerSpec](frontend/03-dedupe-authorization-requests-controller-spec.md)

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn test` (CI job: `jasmine`, which runs `npm run coverage`)

## Notes
- Never run `yarn`/`npm` directly on the host — always through `docker-compose` (see `CLAUDE.md` Boundaries).
- Behaviour-preserving: record the Jasmine spec count from `yarn test` before starting and confirm it is unchanged after each step (a table-driven loop must generate exactly the cases it replaces).
- Keep the full spec names (`describe` chain + `it` text) identical. When looping, either call a local helper from inside each existing `describe`, or reuse the same `describe` title, so names do not change.
- ESLint applies to `specs/` too (max 300 lines per file, max complexity 10); keep helpers small.
- jscpd is not wired into the repo, so there is no local command to re-check duplication; verify by reading the diff.
- Only the `frontend` agent has work; no backend, proxy, cache or infra changes, and no new top-level folder.
