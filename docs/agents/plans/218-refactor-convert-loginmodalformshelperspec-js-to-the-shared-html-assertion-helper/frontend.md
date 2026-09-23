# Frontend Plan: Refactor: Convert LoginModalFormsHelperSpec.js to the shared HTML-assertion helper

Main plan: [plan.md](plan.md)

## Overview
Extend `frontend/specs/support/renderedOutput.js` with `containsElement(tagName, text)`, convert `LoginModalFormsHelperSpec.js` to `renderedOutput` one assertion for one, and prove with the real `eslint-plugin-xss` rule that no findings remain. No production code changes.

## Context
- #216 (PR #257) added `renderedOutput(element)`, which renders once with `renderToStaticMarkup`, keeps the string private and exposes `contains(text)` and `containsTag(tagName)`.
- PR #257 found that the real rule flags:
  - (a) html/markup-named variables and functions, such as the spec's local `markup` and its `html` results.
  - (b) **any string literal matching `/<\/?[a-z]/`** passed to any call. The rule does not inspect template literals.
- The spec has 9 distinct `>X</button>` literals plus `'<form'`, so a plain `contains` swap would still be flagged. That is why `containsElement` is needed.

## Steps

- [01 — Add containsElement to renderedOutput](frontend/01-add-contains-element.md)
- [02 — Convert LoginModalFormsHelperSpec.js](frontend/02-convert-login-modal-forms-helper-spec.md)
- [03 — Run the real no-mixed-html verification gate](frontend/03-verification-gate.md)

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)

## Notes
- The `codacyRuleStubs` stub in `frontend/eslint.config.mjs` stays as it is. The plugin is never committed.
- Don't add a DOM library.
- Coverage must not drop. `renderedOutput.js` is spec support code, but its new method still gets its own spec cases.
