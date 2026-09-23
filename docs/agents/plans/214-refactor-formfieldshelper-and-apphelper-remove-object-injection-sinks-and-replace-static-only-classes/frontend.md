# Frontend Plan: Refactor: FormFieldsHelper and AppHelper: remove object-injection sinks and replace static-only classes

Main plan: [plan.md](plan.md)

## Overview
This plan moves `AppHelper` and `FormFieldsHelper` to the object-module helper shape documented in `.claude/agents/frontend.md` ("Helper module shape"). It removes three `security/detect-object-injection` findings and two `@typescript-eslint/no-extraneous-class` findings, and changes no behavior.

## Context
- `AppHelper.jsx:40` looks up `PAGES[page] ?? PAGES.home` on a plain object.
- `FormFieldsHelper.jsx:22` reads `(state.fieldErrors ?? {})[name]` and `:32` reads `state[name]`.
- Both files are static-only classes whose `eslint-disable-next-line @typescript-eslint/no-extraneous-class` directives describe static classes as the codebase convention. #212 replaced that convention: see `LoginModalHelper.jsx` / `LoginModalFormsHelper.jsx` for the reference shape.
- Callers stay unchanged: `App.jsx` (`AppHelper.render`), `AccountEditFormHelper.jsx` and `LoginModalFormsHelper.jsx` (`FormFieldsHelper.renderField/renderSubmitError/renderSuccess`).

## Steps

- [01 — Convert AppHelper to an object module with a Map page lookup](frontend/01-convert-apphelper.md)
- [02 — Convert FormFieldsHelper to an object module with guarded field reads](frontend/02-convert-formfieldshelper.md)
- [03 — Drop lint exemptions and update convention references](frontend/03-drop-lint-exemptions-and-update-references.md)

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: `jasmine`)

## Notes
- Do not change any spec expectations in `AppHelperSpec`, `FormFieldsHelperSpec`, or `AppSpec`. They pin the existing behavior, including the unknown-key and removed-`recover`-key fallbacks to `home`.
- Keep the exported objects writable: no `Object.freeze` and no namespace imports, so `spyOn` keeps working.
- Coverage must not drop. The new `readField` helper has a missing-source branch and a missing-key branch, and the existing "tolerates a missing fieldErrors object" and "no error for the field" specs already cover them.
