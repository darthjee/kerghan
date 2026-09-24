# Frontend Plan: Refactor: Convert the authorization-request specs to the shared helper and drop dynamic keys in the controller spec

Main plan: [plan.md](plan.md)

## Overview
Spec-only refactor. No production code changes. Every existing case keeps its name, its assertions' meaning and its result.

## Context
- `frontend/specs/support/renderedOutput.js` (from #216, extended in #219) renders an element once and exposes boolean queries: `contains(text)`, `containsTag(tag)`, `containsElement(tag, text)`, `containsAttribute(name, value)`, `containsInOrder(...texts)`. Assertions become `expect(page.contains('x')).toBeTrue()` / `.toBeFalse()`.
- Reference conversions: `AdminUsersHelperSpec.js` and `AdminUsersSpec.js` (#219), `LoginModalFormsHelperSpec.js` (#218), `AccountEditFormHelperSpec.js` (#220).
- Reference for the dynamic-key fix: `AdminUsersControllerSpec.js` (#219), which replaced `method` / `clientMethod` / `args` with `stub: (c) => c.x` and `act: (controller) => controller.y(...)`.

## Steps

- [01 — Convert AuthorizationRequestsHelperSpec](frontend/01-convert-helper-spec.md)
- [02 — Convert AuthorizationRequestsSpec](frontend/02-convert-page-spec.md)
- [03 — Drop dynamic keys in AuthorizationRequestsControllerSpec](frontend/03-drop-dynamic-keys-in-controller-spec.md)

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: Check JS Lint)
- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI: frontend tests + Codacy coverage upload). Coverage must not drop.

## Notes
- Run all tooling through `docker-compose`, never on the host.
- After this change none of the three files should still reference `renderToStaticMarkup` or index `client` / `controller` with a variable key.
