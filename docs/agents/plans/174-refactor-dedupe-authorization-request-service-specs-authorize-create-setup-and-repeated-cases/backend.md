# Backend Plan: Refactor: dedupe authorization-request.service specs (authorize/create setup and repeated cases)

Main plan: [plan.md](plan.md)

## Context
`authorization-request.service.test-support.ts` already exports `createAuthorizationRequestServiceTestContext()`, but every one of the five `authorization-request.service.*.spec.ts` files (`authorize`, `create`, `deny`, `listOpenForUser`, `poll`) still re-declares `let` variables for the members it needs (2 to 6 of the 6 context members) plus a destructuring `beforeEach`. Two more clones remain: the near-identical rejection/no-persist cases in `authorize`/`create`, and the "always computes both counts" assertion pair shared between `authorization-request.service.create.spec.ts` and `authorization-request-abuse-guard.service.spec.ts`.

Decisions taken during discussion (see the issue): the hook returns a **context object with live getters** (call sites become `ctx.service`, `ctx.userRepository`, …), the abuse-guard clone is **in scope** via a shared assertion helper, and the style of the repeated-case dedupe is at the implementer's discretion (`it.each` where only inputs differ, small local builders where the arrange step differs). All existing assertions must be preserved.

## Steps

- [01 — Add the context hook and count-assertion helper](backend/01-add-context-hook-and-count-assertion-helper.md)
- [02 — Convert the five service specs to the hook](backend/02-convert-service-specs-to-hook.md)
- [03 — Dedupe repeated cases and the abuse-guard clone](backend/03-dedupe-repeated-cases-and-abuse-guard-clone.md)

## CI Checks
- `backend`: `docker-compose run kerghan_app npm test` (CI job: `backend_tests`, which runs `npm run coverage`)
- `backend`: `docker-compose run kerghan_app npm run lint` (CI job: `backend_checks`)

## Notes
- Run everything through `docker-compose` (never `yarn`/`npm` on the host), per the project boundaries.
- The hook calls `beforeEach` internally, so it must be invoked inside a `describe` (or at top level of the spec file), not inside a test body.
- The getters must read the *current* context on each access: a new context is built per test, so the object cannot be a one-time destructuring snapshot.
- Jest's `describe`-time code (e.g. `const openRow = buildFakeAuthorizationRequest()`) runs before any `beforeEach`; do not dereference `ctx.*` there.
- jscpd is not part of CI; verify the removal of the listed clones by re-reading the diff (and optionally by running jscpd through docker-compose if the project already provides it).
