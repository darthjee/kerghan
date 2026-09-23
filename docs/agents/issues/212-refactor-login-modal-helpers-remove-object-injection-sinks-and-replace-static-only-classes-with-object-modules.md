# Issue: Refactor: Login modal helpers: remove object-injection sinks and replace static-only classes with object modules

## Description
`LoginModalHelper` and `LoginModalFormsHelper` (under `frontend/assets/js/components/common/loginModal/helpers/`) use bracket lookups into constant tables and are classes containing only static members.

For these two files, this reverses the decision taken in #105 (keep static-only classes and suppress `@typescript-eslint/no-extraneous-class` inline): Codacy keeps reporting the finding despite the inline `eslint-disable-next-line` comment, so the static-class convention is being retired. Sibling issues #214, #227, #228, #229 and #230 apply the same conversion to the remaining static-only helpers/clients.

## Problem
- `LoginModalFormsHelper.jsx:148` (`DEVICE_PANEL_MESSAGES[panel]`), `:223` (`FIELDS_BY_MODE[mode]`), `:224` (`onChangeByField[name]`), `:226` (`SUBMIT_LABELS[mode]`) and `LoginModalHelper.jsx:54` (`TITLES[mode] ?? TITLES.password`) — `security/detect-object-injection` (High), 5 findings. `LoginModalFormsHelper.jsx:212` (`FIELDS_BY_MODE[state.mode] ? state.mode : 'password'`) is the same pattern and is fixed alongside.
- `LoginModalFormsHelper.jsx` and `LoginModalHelper.jsx` — `@typescript-eslint/no-extraneous-class` (Warning), 2 findings ("Unexpected class with only static properties"), still reported despite the inline suppression.

## Expected Behavior
Rendered markup and behaviour are unchanged; call sites still read `LoginModalHelper.render(...)` / `LoginModalFormsHelper.render(...)`, and the specs that `spyOn` them (`LoginModalSpec.js`, `LoginModalHelperSpec.js`) keep working.

## Solution
- Convert `TITLES`, `DEVICE_PANEL_MESSAGES`, `FIELDS_BY_MODE`, `SUBMIT_LABELS` and the per-render `onChangeByField` table to `Map`s; use `.get(...)` / `.has(...)`, keeping the existing fallbacks (`password` title, `password` mode).
- Replace each static-only class with a plain `export default` object literal of the same name exposing the same public method (`render`). Move the `static #renderX` / `#title` / `#formatCountdown` private methods to non-exported module-level functions.
- Cross-helper calls (`LoginModalHelper` → `LoginModalFormsHelper.render`) keep going through the exported object so `spyOn` still intercepts them.
- Do not use `Object.freeze` or a namespace import — Jasmine `spyOn` needs a writable property.
- Remove the now-obsolete `eslint-disable-next-line @typescript-eslint/no-extraneous-class` comments from both files, drop both files from the `reportUnusedDisableDirectives: 'off'` file list in `frontend/eslint.config.mjs`, and update the JSDoc that says they follow the "static-class-with-`#render*`-methods convention".
- Update `.claude/agents/frontend.md` ("Extract to a private `#renderX` static method in the helper") to describe the object-module helper shape with module-level `renderX` functions, as the convention for new and converted helpers. Note there that the migration from static classes is in progress (#214, #227–#230).

## Benefits
Removes seven Codacy findings and moves the login modal off the static-class pattern, starting the migration continued by #214 and #227–#230.

## Verification

- `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` pass, with coverage not reduced.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.
