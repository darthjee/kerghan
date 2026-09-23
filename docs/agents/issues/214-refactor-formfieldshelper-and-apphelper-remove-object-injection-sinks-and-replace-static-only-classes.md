# Issue: Refactor: FormFieldsHelper and AppHelper: remove object-injection sinks and replace static-only classes

## Description
`FormFieldsHelper` and `AppHelper` read objects using variable keys, and both are static-only classes. They are two of the older helpers that still need to move to the object-module helper shape that #212 introduced and documented in `.claude/agents/frontend.md` ("Helper module shape").

## Problem
- `frontend/assets/js/components/common/forms/helpers/FormFieldsHelper.jsx:22` (`(state.fieldErrors ?? {})[name]`) and `:32` (`state[name]`): `security/detect-object-injection` (High)
- `frontend/assets/js/components/helpers/AppHelper.jsx:40` (`PAGES[page] ?? PAGES.home`): `security/detect-object-injection` (High)
- both classes: `@typescript-eslint/no-extraneous-class` (Warning), currently suppressed with `eslint-disable-next-line` directives that call static-only classes "this codebase's deliberate convention". #212 has since replaced that convention.

## Expected Behavior
Field rendering (value, error, change handler, input id) and page selection work as before. An unknown page still falls back to `home`. Callers (`App.jsx`, `AccountEditFormHelper.jsx`, `LoginModalFormsHelper.jsx`) keep calling `FormFieldsHelper.renderField/renderSubmitError/renderSuccess` and `AppHelper.render` without changes.

## Solution
Follow the object-module shape from #212 (see `LoginModalHelper.jsx` for a reference):

- **AppHelper**: turn `PAGES` into a `Map` and look pages up with `PAGES.get(page) ?? PAGES.get('home')`. Replace the class with a plain exported object literal `const AppHelper = { render(page) { … } }`.
- **FormFieldsHelper**: read field values and errors through `Object.hasOwn`-guarded access, for example a private module-level `readField(source, name)` function that returns `undefined` when the key is missing. Replace the class with a plain exported object literal that keeps the same method names.
- Keep the exported objects writable: no `Object.freeze` and no namespace imports, so `spyOn` keeps working.
- Remove the two `eslint-disable-next-line @typescript-eslint/no-extraneous-class` directives. Also remove both files from the `reportUnusedDisableDirectives: 'off'` file list in `frontend/eslint.config.mjs`, as #212 did for the login-modal helpers.
- `HeaderHelper.jsx`'s disable comment says it matches `components/helpers/AppHelper.jsx`. That reference will no longer be true, so reword it. HeaderHelper itself is not migrated here.
- In `.claude/agents/frontend.md`, remove `#214` from the "Older helpers/clients are still static classes and are being migrated" note.
- Keep the expectations in `FormFieldsHelperSpec`, `AppHelperSpec`, and `AppSpec` unchanged.

## Benefits
Removes five Codacy findings, keeps the shared form-field renderer free of dynamic-key access, and moves two more helpers to the documented object-module convention.

## Verification

- `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` pass, and coverage does not drop.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
