# Plan: Refactor: Convert the remaining small spec files to the shared HTML-assertion helper

Main plan: [plan.md](plan.md)

## Overview
Remove the last 8 `xss/no-mixed-html` findings in the spec tree. Every remaining `renderToStaticMarkup` call and HTML-literal assertion in five specs moves to the shared `renderedOutput` helper (`frontend/specs/support/renderedOutput.js`). The helper gets a new `isEmpty()` query so the "renders nothing" cases can drop their `<div></div>` literal. No production code changes.

## Context
- `renderedOutput(element)` renders once and exposes `contains`, `containsTag`, `containsElement`, `containsAttribute` and `containsInOrder`. Its behavior is covered by `frontend/specs/support/renderedOutputSpec.js`.
- Decision made while refining the issue: add `isEmpty()` to the helper, and render the null-returning components directly, with no wrapper `<div>`. `ResetPasswordLanding` and `ModalRedirect` both `return null`, so `renderToStaticMarkup` produces `''`.
- `MyAccountHelperSpec.js` was mostly converted by #216. The only markup literal left there is `contains('id="my-account-currentPassword"')`.
- Style reference: specs already converted in #219–#222 (e.g. `FormFieldsHelperSpec.js`, `AccountEditFormHelperSpec.js`). They use boolean assertions with `.withContext(...)`.

## Steps

- [01 — Add isEmpty() to renderedOutput](frontend/01-add-is-empty-to-rendered-output.md)
- [02 — Convert the "renders nothing" specs](frontend/02-convert-renders-nothing-specs.md)
- [03 — Convert MyAccountHelperSpec, LoginModalSpec and AppSpec](frontend/03-convert-remaining-specs.md)

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: `jasmine`). Coverage must not drop.

## Notes
- Keep the same `it` cases and the same described behavior in the five specs. The new `isEmpty` cases in `renderedOutputSpec.js` are the only additions.
- When done, no `renderToStaticMarkup` import may remain in the five specs, and no string may hold an HTML literal (`<tag`, `</`, `name="value"`).
