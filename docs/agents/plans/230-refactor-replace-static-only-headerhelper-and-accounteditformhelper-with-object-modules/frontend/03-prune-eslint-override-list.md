# Prune stale reportUnusedDisableDirectives entries
The override block in `frontend/eslint.config.mjs` with `linterOptions: { reportUnusedDisableDirectives: 'off' }` exists only for files with `eslint-disable` comments that reference a `codacyRuleStubs` rule: `xss/no-mixed-html`, `security/detect-object-injection`, `@typescript-eslint/no-extraneous-class` or `security-node/non-literal-reg-expr`. The earlier migrations (#227–#229) removed those comments but left the files on the list, which silences unused-directive detection there for no reason.

After steps 01 and 02, only `assets/js/components/resources/admin/pages/helpers/AdminUsersHelper.jsx` still has such a comment (`security/detect-object-injection`). First re-run a grep to confirm, e.g. `grep -rn "eslint-disable" frontend/assets frontend/specs`. Then reduce the `files` array to exactly the files that still have a Codacy-stub directive. Expected result:

```js
files: [
  'assets/js/components/resources/admin/pages/helpers/AdminUsersHelper.jsx',
],
```

Keep the block's explanatory comment and `codacyRuleStubs` unchanged.

Entries to remove: the six `assets/js/client/*.js` files (`AccountsClient`, `AdminClient`, `ApiClient`, `AuthEvents`, `AuthSession`, `LoginModalEvents`), `AccountEditFormHelper.jsx`, `HeaderHelper.jsx`, `AuthorizationRequestsHelper.jsx`, `MyAccountHelper.jsx`, `AdminUserEditHelper.jsx`, `assets/js/utils/routing/Route.js` and `specs/support/fetchSequence.js`.

## Files to Change
- `frontend/eslint.config.mjs`: trim the `reportUnusedDisableDirectives: 'off'` override's `files` list.
