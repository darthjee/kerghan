# Plan: Refactor: Replace static-only admin and accounts page helpers with object modules

Issue: [229-refactor-replace-static-only-admin-and-accounts-page-helpers-with-object-modules.md](../../issues/229-refactor-replace-static-only-admin-and-accounts-page-helpers-with-object-modules.md)

## Overview
Replace the four static-only helper classes with plain default-exported object literals of the same name. Each object exposes only `render`. Private `static #x` methods become module-level functions. The rendered output, public API and specs stay the same.

## Context
Codacy reports `@typescript-eslint/no-extraneous-class` on each of these files. The `eslint-disable-next-line` comments in them don't suppress it on Codacy. #227 and #228 applied the same refactor to the client classes (see `frontend/assets/js/client/AuthSession.js`, `AccountsClient.js` for the target style: `const`/`function` helpers at module level, JSDoc kept, a single default-exported object). `HeaderHelper` and `AccountEditFormHelper` are out of scope; #230 covers them.

## Implementation Steps

### Step 1 — Convert the thin wrappers `AdminUserEditHelper` and `MyAccountHelper`
Each is a class with a single `static render(state, handlers)` that delegates to `AccountEditFormHelper.render(...)`. Rewrite each one as:

```jsx
/**
 * Rendering helper for the Admin User Edit page.
 */
const AdminUserEditHelper = {
  /** ...existing JSDoc... */
  render(state, handlers) {
    return AccountEditFormHelper.render(state, handlers, { ... });
  },
};

export default AdminUserEditHelper;
```

Remove the `// eslint-disable-next-line @typescript-eslint/no-extraneous-class` line and the explanatory comment lines under it. Keep the imports and constants in `MyAccountHelper` (if any) and the existing JSDoc exactly as they are.

### Step 2 — Convert `AdminUsersHelper` and `AuthorizationRequestsHelper`
- Move every `static #privateName(...)` method to a module-level `function privateName(...)`. Keep its JSDoc, don't export it, and define it above the exported object so there are no use-before-define lint errors.
- Replace every `XHelper.#privateName(...)` call (including those inside `.map(...)` callbacks and ternaries) with `privateName(...)`.
- The exported object only contains `render(state, handlers)`, with its JSDoc.
- Remove the `no-extraneous-class` disable comment block. Keep unrelated disables, such as the `{/* eslint-disable-next-line security/detect-object-injection -- ... */}` JSX comment in `AdminUsersHelper`'s row rendering.
- Keep the `AuthorizationRequestsHelper` `#formatAge` logic exactly as it is (as module-level `formatAge`).
- If a helper name clashes with an import or a top-level identifier, prefix it (e.g. `renderUserRow`) instead of shadowing.

## Files to Change
- `frontend/assets/js/components/resources/admin/pages/helpers/AdminUserEditHelper.jsx`: class → object literal
- `frontend/assets/js/components/resources/accounts/pages/helpers/MyAccountHelper.jsx`: class → object literal
- `frontend/assets/js/components/resources/admin/pages/helpers/AdminUsersHelper.jsx`: class → object literal, 5 privates → module functions
- `frontend/assets/js/components/resources/accounts/pages/helpers/AuthorizationRequestsHelper.jsx`: class → object literal, 7 privates → module functions

Do **not** change:
- `frontend/eslint.config.mjs`: leave the `reportUnusedDisableDirectives: 'off'` file list as is, matching #228.
- Any spec under `frontend/specs/`, including `accountEditFormHelperExamples.js`. They must pass unmodified as regression proof.
- The page components that call `XHelper.render(...)`.

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `yarn_project` lint)
- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: `yarn_project` coverage). Coverage must not drop.

## Notes
- Don't use `Object.freeze` or namespace imports (`import * as`); the issue rules both out.
- Moving the privates out removes class-private encapsulation. Module-level non-exported functions keep them private to the module, which is enough.
- Run every tool through `docker-compose`, never on the host.
