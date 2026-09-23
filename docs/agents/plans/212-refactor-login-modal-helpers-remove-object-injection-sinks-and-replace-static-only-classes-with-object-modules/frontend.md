# Frontend Plan: Refactor: Login modal helpers: remove object-injection sinks and replace static-only classes with object modules

Main plan: [plan.md](plan.md)

## Overview
Clear 5 `security/detect-object-injection` and 2 `@typescript-eslint/no-extraneous-class` Codacy findings in `frontend/assets/js/components/common/loginModal/helpers/`. Tables become `Map`s, classes become exported object literals with private methods moved to module-level functions, and the convention docs switch to the object-module shape. This is the first file pair of a migration continued by #214 and #227–#230.

## Context
#105 kept static-only classes and suppressed the rule with `// eslint-disable-next-line @typescript-eslint/no-extraneous-class` comments, but Codacy still reports them. The project's own ESLint run stubs that rule out (`codacyRuleStubs` in `frontend/eslint.config.mjs`), and the suppressed files are listed in a `reportUnusedDisableDirectives: 'off'` block. Specs `spyOn(LoginModalHelper, 'render')` (`LoginModalSpec.js`) and `spyOn(LoginModalFormsHelper, 'render')` (`LoginModalHelperSpec.js`), so the exported objects must stay writable (no `Object.freeze`, no namespace import) and cross-helper calls must keep going through the exported object.

## Steps

- [01 — Convert LoginModalHelper](frontend/01-convert-login-modal-helper.md)
- [02 — Convert LoginModalFormsHelper](frontend/02-convert-login-modal-forms-helper.md)
- [03 — Drop lint exemptions and update the helper convention](frontend/03-lint-config-and-convention-docs.md)

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: `jasmine`) — coverage must not drop.

## Notes
- Other helpers/clients (e.g. `HeaderHelper`, `FormFieldsHelper`, `client/*`) stay static classes until their sibling issues land; do not touch them here.
- Existing specs should pass unchanged; only adjust them if they reference class-specific behaviour (none expected, since private `#` methods were never spied on).
- Unknown modes must keep the current fallbacks: title → `'Log in'` (password), form → password fields and `'Log in'` submit label.
