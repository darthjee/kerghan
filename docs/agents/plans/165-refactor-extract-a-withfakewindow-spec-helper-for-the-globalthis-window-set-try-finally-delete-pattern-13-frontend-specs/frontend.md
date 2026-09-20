# Frontend Plan: Refactor: extract a withFakeWindow spec helper for the globalThis.window set/try/finally/delete pattern (13 frontend specs)

Main plan: [plan.md](plan.md)

## Overview
13 specs under `frontend/specs/assets/js` fake `globalThis.window` in two hand-rolled ways: per-test `try/finally` + `delete globalThis.window` (5 specs), and `beforeEach` save `originalWindow` / `afterEach` restore (8 specs). Replace both with one helper in `frontend/specs/support/fakeWindow.js`, following the decisions from the issue discussion: `installFakeWindow(fake)` used with an `afterEach` cleanup (no callback-style `withFakeWindow`), restoring the *previous* `window` value or deleting it when there was none.

## Context
- Node-based Jasmine specs have no DOM, so `window` is undefined by default; fakes are either `{ location: { hash: ... } }` or an `EventTarget` (for specs exercising `AuthEvents` / `LoginModalEvents`).
- Some specs install the fake in only a few tests (e.g. `AdminUsersControllerSpec.js`, `RegisterControllerSpec.js`), and `ResetPasswordLandingSpec.js` re-assigns `globalThis.window` mid-test. The helper must therefore tolerate being called more than once per test and keep the *original* value from the first install.
- `frontend/specs/support/` already holds shared spec code (`accountEditFormControllerExamples.js`); the Jasmine glob `specs/**/*[sS]pec.js` picks up a `fakeWindowSpec.js` placed there.
- Test outcomes must not change; this is a pure refactor.

## Steps

- [01 — Add the fakeWindow helper](frontend/01-add-fake-window-helper.md)
- [02 — Migrate HeaderControllerSpec](frontend/02-migrate-header-controller-spec.md)
- [03 — Migrate the remaining try/finally specs](frontend/03-migrate-try-finally-specs.md)
- [04 — Migrate the originalWindow save/restore specs](frontend/04-migrate-original-window-specs.md)
- [05 — Verify](frontend/05-verify.md)

## CI Checks
- `frontend/`: `docker-compose run kerghan_fe yarn coverage` (CI job: `jasmine`)
- `frontend/`: `docker-compose run kerghan_fe yarn lint` (CI job: `frontend-checks`)

## Notes
- Never run `yarn`/`npm` directly on the host — always through `docker-compose` (project boundary).
- ESLint enforces JSDoc on public API, max complexity 10, max 300 lines/file: document the helper's exports.
- Keep the `// Node-based Jasmine specs run without a DOM ...` explanatory comments where the fake is an `EventTarget`, adjusting them to point at the helper.
