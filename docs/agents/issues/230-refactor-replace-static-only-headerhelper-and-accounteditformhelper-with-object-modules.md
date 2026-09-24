# Issue: Refactor: Replace static-only HeaderHelper and AccountEditFormHelper with object modules

## Description
Two frontend helpers are still classes with only static members, so Codacy flags them under `@typescript-eslint/no-extraneous-class`. This continues the object-module migration already done in #227, #228 and #229.

## Problem
`@typescript-eslint/no-extraneous-class` (Warning), 2 findings:

- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx`: public `render`, plus private `#renderAuthLinks`, `#renderLoginLink`, `#renderAdminLink` and `#renderMyAccountDropdown`.
- `frontend/assets/js/components/common/forms/helpers/AccountEditFormHelper.jsx`: public `render` only.

Both files currently silence the rule with an `eslint-disable-next-line @typescript-eslint/no-extraneous-class` comment, which Codacy ignores.

## Expected Behavior
- Rendered markup and behaviour are unchanged.
- Callers (`Header.jsx`, `MyAccountHelper.jsx`, `AdminUserEditHelper.jsx`) keep calling `HeaderHelper.render(...)` and `AccountEditFormHelper.render(...)` through the same default import, with no edits.
- The existing specs pass unmodified.
- The `reportUnusedDisableDirectives: 'off'` override in `frontend/eslint.config.mjs` lists only files that still carry a Codacy-only disable comment. Unused-directive detection is back on everywhere else, and `yarn lint` stays clean.

## Solution
Follow the shape used in #229 (e.g. `MyAccountHelper.jsx`):

- Replace each class with a `const <Name> = { render(...) { ... } };` object literal plus `export default <Name>;`.
- Turn `HeaderHelper`'s `static #renderX` private methods into non-exported module-level functions (`renderAuthLinks`, `renderLoginLink`, `renderAdminLink`, `renderMyAccountDropdown`), and update the internal calls.
- Remove the `eslint-disable-next-line @typescript-eslint/no-extraneous-class` comments.
- Update JSDoc that points at private members. For example, `{@link HeaderHelper.#renderAdminLink}` in `renderMyAccountDropdown`'s doc becomes a reference to the module-level function.
- Do not use `Object.freeze` or namespace imports. Leave the specs as they are.
- Clean up the `reportUnusedDisableDirectives: 'off'` block in `frontend/eslint.config.mjs`. It should list only the files that still have a Codacy-only `eslint-disable` comment (a rule from `codacyRuleStubs`). After this refactor that leaves just `assets/js/components/resources/admin/pages/helpers/AdminUsersHelper.jsx`, which still has `security/detect-object-injection`. Remove these stale entries, which have no such comment anymore:
  - `assets/js/client/AccountsClient.js`, `AdminClient.js`, `ApiClient.js`, `AuthEvents.js`, `AuthSession.js`, `LoginModalEvents.js`
  - `assets/js/components/common/forms/helpers/AccountEditFormHelper.jsx`
  - `assets/js/components/common/header/helpers/HeaderHelper.jsx`
  - `assets/js/components/resources/accounts/pages/helpers/AuthorizationRequestsHelper.jsx`, `MyAccountHelper.jsx`
  - `assets/js/components/resources/admin/pages/helpers/AdminUserEditHelper.jsx`
  - `assets/js/utils/routing/Route.js`
  - `specs/support/fetchSequence.js`

  Keep the block and its comment, and keep `codacyRuleStubs` itself unchanged. Before finalising the list, re-run a grep for `eslint-disable` in case the codebase has moved on.

## Benefits
Removes 2 Warning findings and makes these helpers match the rest of the migrated frontend helpers.

## Verification

- `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` pass, with coverage not reduced.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
