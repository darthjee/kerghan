# Backend Plan: Complexity: authorization-request.controller.e2e-spec.ts is 623 lines — split into focused spec files

Main plan: [plan.md](plan.md)

## Steps

- [01 — Extract shared e2e test support](backend/01-extract-shared-test-support.md)
- [02 — Split off the create scenario](backend/02-split-create-scenario.md)
- [03 — Split off the poll scenario](backend/03-split-poll-scenario.md)
- [04 — Split off the approver routes scenario](backend/04-split-approver-scenario.md)
- [05 — Split off abuse hardening and remove the original file](backend/05-split-abuse-hardening-and-cleanup.md)

## CI Checks

- `backend`: `npm run coverage` (CI job: `backend_tests`)
- `backend`: `npm run lint` (CI job: `backend_checks`)

## Notes

- Original file: `backend/src/auth/tests/authorization-request.controller.e2e-spec.ts`, 773 non-comment lines (623 at the time Codacy flagged it, in issue #99).
- Naming mirrors #98's split of `authorization-request.service.spec.ts`: `<base>.<method-or-scenario>.spec.ts` + `<base>.test-support.ts`. Here the base is `authorization-request.controller` and the original suffix is `.e2e-spec.ts`, so files become `authorization-request.controller.<scenario>.e2e-spec.ts` and `authorization-request.controller.e2e-test-support.ts`.
- The top-level helpers `createAuthorizationRequest` and `approve` (currently declared once inside the outer `describe`, lines 225–240 of the original file) are **not** exported from the shared support file — each resulting spec file only needs the subset it actually uses, declared locally against its own `app`/`authorizationRequestRepo` closure:
  - `create` scenario: uses neither helper.
  - `poll` scenario: uses both `createAuthorizationRequest` and `approve`.
  - `approver` scenario: uses `createAuthorizationRequest` only.
  - `abuse-hardening` scenario: uses `createAuthorizationRequest` only.
- Each split file keeps its own top-level `describe('AuthorizationRequestController (e2e)', () => { ... })` with its own `beforeEach`/`afterEach` app lifecycle (`app = await buildTestApp(...)` / `await app.close()`), importing `matchesCondition`, `createInMemoryRepo`, and `buildTestApp` from the new support file.
- No behavior change — this is a pure test-file reorganization. No production code, entities, or migrations are touched.
