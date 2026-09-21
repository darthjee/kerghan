# Backend Plan: Refactor: dedupe authorization-request controller e2e specs (approver, abuse-hardening, poll, create)

Main plan: [plan.md](plan.md)

## Overview
All changes stay inside `backend/src/auth/tests/`. Add four helpers to `authorization-request.controller.e2e-test-support.ts` (`useTestApp`, `postMine`, `expectUniformCreateResponse`, `fillCreateLimit`) and migrate the four specs (`approver`, `abuse-hardening`, `poll`, `create`) onto them. Same tests, same assertions, same test count; jscpd must stop reporting these clones.

## Context
jscpd reports ~120 duplicated lines across the four specs: the `buildTestApp()`/`app.close()` scaffold, the `POST .../mine.json` + cookie request (5× in `approver`), the `{ uuid, pollToken, expiresAt }` `toEqual` block (6× across `create` and `abuse-hardening`), and two near-identical create-limit fill loops in `abuse-hardening`. Scope is limited to the flagged clones — `postPoll`/`postAuthorize`/`postDeny` helpers are intentionally out of scope.

## Steps

- [01 — Add the shared helpers](backend/01-add-shared-helpers.md)
- [02 — Migrate the create and poll specs](backend/02-migrate-create-and-poll-specs.md)
- [03 — Migrate the approver spec](backend/03-migrate-approver-spec.md)
- [04 — Migrate the abuse-hardening spec](backend/04-migrate-abuse-hardening-spec.md)

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: backend tests, `npm run coverage`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: backend lint, `npm run lint`)

## Notes
- Before/after, count tests in the four specs (e.g. `yarn test --listTests`/verbose output) to confirm none were dropped or merged; assertions must stay identical (the helper wraps the exact same `toEqual` shape).
- `useTestApp()` registers `beforeEach`/`afterEach` itself, so it must be called synchronously inside a `describe` body. `app` is reassigned per test, hence the returned context exposes getters (`ctx.app`, `ctx.authorizationRequestRepo`) rather than plain values.
- `abuse-hardening` has a nested `create — concurrent open cap` block with its own `capApp`/`capRepo` built via `buildTestApp({ ...configOverrides })` and its own `afterEach` — it does not use the outer context and should stay as is (or at most be left untouched).
- Keep the specs' `describe('AuthorizationRequestController (e2e)')` names and existing comment density; all comments in English.
- If jscpd is available in the containers, run it over `backend/src/auth/tests/` to confirm the clones are gone; if not, verify by inspection against the ranges in the issue (the repo has no jscpd config checked in).
