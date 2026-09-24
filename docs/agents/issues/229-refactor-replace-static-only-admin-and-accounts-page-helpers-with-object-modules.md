# Issue: Refactor: Replace static-only admin and accounts page helpers with object modules

## Description
Four page helpers contain only static members, which Codacy flags. This follows the same pattern already applied to the client classes in #227 and #228; `HeaderHelper` and `AccountEditFormHelper` are handled separately in #230.

## Problem
`@typescript-eslint/no-extraneous-class` (Warning), 4 findings:

- `frontend/assets/js/components/resources/admin/pages/helpers/AdminUsersHelper.jsx` (`render` + 5 `static #render*` privates)
- `frontend/assets/js/components/resources/admin/pages/helpers/AdminUserEditHelper.jsx` (`render` only; thin wrapper over `AccountEditFormHelper`)
- `frontend/assets/js/components/resources/accounts/pages/helpers/MyAccountHelper.jsx` (`render` only; thin wrapper over `AccountEditFormHelper`)
- `frontend/assets/js/components/resources/accounts/pages/helpers/AuthorizationRequestsHelper.jsx` (`render` + 7 `static #*` privates, including `#formatAge`)

Each file currently carries an `eslint-disable-next-line @typescript-eslint/no-extraneous-class` comment that doesn't stop Codacy from reporting the finding.

## Expected Behavior
Rendered markup and behaviour are unchanged; pages still call `XHelper.render(...)` through the default export, and the shared spec examples that receive the helper as an option (`accountEditFormHelperExamples.js`) keep working.

## Solution
- Replace each class with a plain default-exported object literal of the same name, exposing only `render` (the current public surface).
- Move every `static #privateX` method to a module-level (non-exported) function and replace `XHelper.#privateX(...)` calls with direct calls.
- Remove the `no-extraneous-class` `eslint-disable-next-line` comment and its explanatory lines from each file; keep any unrelated disables (e.g. `security/detect-object-injection` in `AdminUsersHelper`) and JSDoc.
- Leave the `reportUnusedDisableDirectives: 'off'` file list in `frontend/eslint.config.mjs` unchanged, as #228 did.
- Do not use `Object.freeze` or namespace imports. Keep the existing helper specs unchanged; they serve as regression proof.

## Benefits
Removes 4 Warning findings and makes these helpers plain modules, like the client modules already converted.

## Verification

- `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` pass, with coverage not reduced.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
