# Backend Plan: Refactor: dedupe login/register request boilerplate and spec headers across auth.controller e2e specs

Main plan: [plan.md](plan.md)

## Overview
The `auth.controller.*.e2e-spec.ts` files and `admin.controller.e2e-spec.ts` in `backend/src/auth/tests/` repeat the same `beforeEach`/`afterEach` scaffold and the same `POST /auth/login.json` / `POST /auth/register.json` supertest blocks. This plan adds shared helpers next to the existing `buildTestApp` and applies them to every affected spec, without changing what any test asserts.

## Context
- `auth.controller.e2e-test-support.ts` currently exports only `buildTestApp({ adminGuard, registerDefaultUser })`, the throwaway `ProtectedTestController`/`PublicTestController`, and re-exports `createInMemoryRepo`/`matchesCondition`.
- `authorization-request.controller.e2e-test-support.ts` already has a getter-based `useTestApp()` (registers `beforeEach`/`afterEach`, exposes `app`, `userRepo`, `authorizationRequestRepo`) and a cookie-returning `login(app, username, password)`. These are the precedents to follow.
- Specs carrying the standard scaffold: `login`, `guard`, `skip-cache`, `recovery`, `account`, `refresh-logout` (all `buildTestApp()`), and `admin.controller.e2e-spec.ts` (`buildTestApp({ adminGuard: true, registerDefaultUser: false })`).
- `auth.controller.spec.ts` is a unit spec (not e2e) and is out of scope.

## Steps

- [01 — Add shared request helpers](backend/01-add-request-helpers.md)
- [02 — Add auth useTestApp helper](backend/02-add-use-test-app.md)
- [03 — Apply helpers to the auth specs](backend/03-apply-helpers-to-specs.md)
- [04 — Apply helpers to the admin spec](backend/04-apply-helpers-to-admin-spec.md)

## CI Checks
- `backend`: `docker-compose run kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes
- Never run `yarn`/`npm` directly on the host — always through `docker-compose` (see `CLAUDE.md`).
- Test names and assertions must stay identical; the total number of tests should not change. Compare the Jest test count before/after.
- `refresh-logout`'s "expired refresh token" test relies on `refreshTokenRepo.rows[length - 1]` being the token created by its own login call — `loginAs` must issue exactly one login request so that stays true.
- Nothing else in `backend/src/auth/tests/` should be touched, and no production code changes.
