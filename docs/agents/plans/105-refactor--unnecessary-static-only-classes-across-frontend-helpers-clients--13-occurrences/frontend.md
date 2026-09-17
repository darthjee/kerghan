# frontend Plan: Refactor: unnecessary static-only classes across frontend helpers/clients (13 occurrences)

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Add the deliberate-convention suppression comment to each remaining flagged file

Add a narrowly-scoped `// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- ...` comment directly above each `export default class ...` line, following the exact wording pattern already used in `frontend/assets/js/client/AuthEvents.js`, `frontend/assets/js/client/AuthSession.js`, and `frontend/assets/js/client/LoginModalEvents.js`:

```
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- static-methods-only
// utility/client class is this codebase's deliberate convention, matching client/X.js.
export default class Y {
```

Pick `client/X.js` in the trailing clause to point at whichever sibling file's style is the closest match (an already-suppressed file where one fits naturally, otherwise another file in this same list) — mirror how `AuthSession.js`'s comment already points at `ApiClient.js` even though `ApiClient.js` itself isn't suppressed yet.

Apply to all 11 remaining files:
- `frontend/assets/js/client/AccountsClient.js`
- `frontend/assets/js/client/AdminClient.js`
- `frontend/assets/js/client/ApiClient.js`
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx`
- `frontend/assets/js/components/common/loginModal/helpers/LoginModalFormsHelper.jsx`
- `frontend/assets/js/components/common/loginModal/helpers/LoginModalHelper.jsx`
- `frontend/assets/js/components/helpers/AppHelper.jsx`
- `frontend/assets/js/components/resources/accounts/pages/helpers/AuthorizationRequestsHelper.jsx`
- `frontend/assets/js/components/resources/accounts/pages/helpers/MyAccountHelper.jsx`
- `frontend/assets/js/components/resources/admin/pages/helpers/AdminUserEditHelper.jsx`
- `frontend/assets/js/components/resources/admin/pages/helpers/AdminUsersHelper.jsx`

Do not touch `backend/src/core/logging.module.ts` — it's out of this issue's scope (tracked separately per the issue body).

### Step 2 — Register the newly-suppressed files and verify

`frontend/eslint.config.mjs`'s third config block (`linterOptions: { reportUnusedDisableDirectives: 'off' }`) exists because the project's own ESLint config stubs `no-extraneous-class` to a no-op (see `codacyRuleStubs` at the top of that file), so any real `eslint-disable-next-line` referencing it is "unused" from the local linter's point of view unless the owning file is listed there. Add all 11 files from Step 1 to that block's `files` array (alongside the existing 6 entries), then run `npm run lint` from `frontend/` and confirm it passes with no new warnings/errors — in particular no "unused eslint-disable directive" warnings on the files just touched.

## Files to Change
- `frontend/assets/js/client/AccountsClient.js` — add suppression comment above `export default class AccountsClient`
- `frontend/assets/js/client/AdminClient.js` — add suppression comment above `export default class AdminClient`
- `frontend/assets/js/client/ApiClient.js` — add suppression comment above `export default class ApiClient`
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx` — add suppression comment above `export default class HeaderHelper`
- `frontend/assets/js/components/common/loginModal/helpers/LoginModalFormsHelper.jsx` — add suppression comment above `export default class LoginModalFormsHelper`
- `frontend/assets/js/components/common/loginModal/helpers/LoginModalHelper.jsx` — add suppression comment above `export default class LoginModalHelper`
- `frontend/assets/js/components/helpers/AppHelper.jsx` — add suppression comment above `export default class AppHelper`
- `frontend/assets/js/components/resources/accounts/pages/helpers/AuthorizationRequestsHelper.jsx` — add suppression comment above `export default class AuthorizationRequestsHelper`
- `frontend/assets/js/components/resources/accounts/pages/helpers/MyAccountHelper.jsx` — add suppression comment above `export default class MyAccountHelper`
- `frontend/assets/js/components/resources/admin/pages/helpers/AdminUserEditHelper.jsx` — add suppression comment above `export default class AdminUserEditHelper`
- `frontend/assets/js/components/resources/admin/pages/helpers/AdminUsersHelper.jsx` — add suppression comment above `export default class AdminUsersHelper`
- `frontend/eslint.config.mjs` — add the 11 files above to the `reportUnusedDisableDirectives: 'off'` file list

## CI Checks
- `frontend`: `npm run lint` (CI job: `frontend-checks`)

## Notes
- The raw Codacy finding suggested converting these classes to plain modules; this plan deliberately does not do that — it follows the codebase's own existing precedent (3 already-suppressed files) instead, per discussion on issue #105.
- `backend/src/core/logging.module.ts:28` (the 15th occurrence in the original finding, an empty class rather than a static-only one) is intentionally excluded from this plan — out of scope for this issue.
