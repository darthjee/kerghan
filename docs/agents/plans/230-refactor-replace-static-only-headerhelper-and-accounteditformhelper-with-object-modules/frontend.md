# Frontend Plan: Refactor: Replace static-only HeaderHelper and AccountEditFormHelper with object modules

Main plan: [plan.md](plan.md)

## Overview
Two frontend helpers, `HeaderHelper` and `AccountEditFormHelper`, are still static-only classes. Codacy flags them under `@typescript-eslint/no-extraneous-class`. Convert them to object modules, the same way #229 did for `MyAccountHelper`, `AdminUserEditHelper`, `AdminUsersHelper` and `AuthorizationRequestsHelper`. Then remove the stale entries from the `reportUnusedDisableDirectives: 'off'` override in `frontend/eslint.config.mjs`.

## Context
- The target shape is `frontend/assets/js/components/resources/accounts/pages/helpers/MyAccountHelper.jsx`: `const X = { render(...) { ... } };` followed by `export default X;`. Private helpers are non-exported module-level functions.
- Callers must not change: `common/header/Header.jsx` (`HeaderHelper.render(...)`), plus `MyAccountHelper.jsx` and `AdminUserEditHelper.jsx` (`AccountEditFormHelper.render(...)`).
- The specs stay unmodified, which proves the rendered output hasn't changed.
- Don't use `Object.freeze` or namespace imports.

## Steps

- [01 — Convert HeaderHelper to an object module](frontend/01-convert-header-helper.md)
- [02 — Convert AccountEditFormHelper to an object module](frontend/02-convert-account-edit-form-helper.md)
- [03 — Prune stale reportUnusedDisableDirectives entries](frontend/03-prune-eslint-override-list.md)

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: `jasmine`). Coverage must not drop.

## Notes
- Run all tooling through `docker-compose`, never directly on the host.
- Removing entries from the override turns unused-directive detection back on for those files. If `yarn lint` then reports an unused `eslint-disable` in one of them, that directive references a real rule, not a Codacy stub. Investigate it rather than putting the file back on the list blindly.
