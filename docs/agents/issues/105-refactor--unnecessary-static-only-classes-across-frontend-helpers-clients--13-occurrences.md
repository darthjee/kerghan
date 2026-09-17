# Issue: Refactor: unnecessary static-only classes across frontend helpers/clients (13 occurrences)

## Description
Codacy's ESLint `@typescript-eslint/no-extraneous-class` rule flags 14 classes across the codebase whose bodies contain only static members (or, for one, an empty body): 13 in `frontend/` (HTTP/event-bus "client" wrappers and JSX rendering "helper" classes) and 1 in `backend/` (`backend/src/core/logging.module.ts:28`, an empty `LoggingModule` body decorated with `@Module(...)`).

Investigation of the current code shows this codebase already has a partial, deliberate precedent for these classes: three files (`frontend/assets/js/client/AuthSession.js`, `frontend/assets/js/client/AuthEvents.js`, `frontend/assets/js/client/LoginModalEvents.js`) carry a narrowly-scoped `// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- static-methods-only utility/client class is this codebase's deliberate convention, matching client/X.js.` comment, and are listed in `frontend/eslint.config.mjs`'s `reportUnusedDisableDirectives: 'off'` file set (since the project's own ESLint config already stubs this rule out as a no-op — see `codacyRuleStubs` in that file — so the directive only matters for Codacy's stricter analysis, not the local lint run). The remaining flagged frontend files do not yet carry this suppression.

## Problem
A plain module of exported functions/constants would achieve the same thing as each of these classes without the indirection of instantiating something that's never instantiated — which is what the ESLint rule is designed to catch. However, part of this codebase has already deliberately chosen to keep the static-class shape (documented via the suppression comment described above) for client/event-bus wrappers, and several JSX "helper" classes carry their own JSDoc noting they deliberately follow "the same static-class-with-`#render*`-methods convention" as sibling helpers — without needing the ESLint suppression at all, since the local config never flags them.

## Solution
Bring the remaining 10 flagged frontend files in line with the existing, deliberate convention rather than converting them to plain modules:

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

For each: add the same `// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- static-methods-only utility/client class is this codebase's deliberate convention, matching client/X.js.`-style comment directly above the `export default class ...` line, referencing an already-suppressed sibling file, and add the file to `frontend/eslint.config.mjs`'s `reportUnusedDisableDirectives: 'off'` file list.

`backend/src/core/logging.module.ts:28` is tracked separately — it is an empty class body, not a static-only one, and is out of this issue's frontend scope.

## Benefits
- Clears all 13 Codacy findings for this pattern in `frontend/` without changing any public import paths or call-site ergonomics.
- Makes the codebase's deliberate static-class convention for client/event-bus/helper wrappers explicit and consistent everywhere it's used, instead of only in 3 of 13 files.
