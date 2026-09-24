# Issue: Refactor: Replace static-only classes AuthSession, AuthEvents and LoginModalEvents with object modules

## Description
Three client-layer classes in `frontend/assets/js/client/` contain only static members: `AuthSession`, `AuthEvents` and `LoginModalEvents`. Codacy flags each one. This is the follow-up to #227, which converted `ApiClient`, `AdminClient` and `AccountsClient` to object modules.

The inline `// eslint-disable-next-line @typescript-eslint/no-extraneous-class` comments on these classes do not suppress Codacy's findings. Rewriting the classes is the fix.

## Problem
Codacy reports 3 `@typescript-eslint/no-extraneous-class` (Warning) findings:

- `frontend/assets/js/client/AuthSession.js`
- `frontend/assets/js/client/AuthEvents.js`
- `frontend/assets/js/client/LoginModalEvents.js`

## Expected Behavior
- Callers keep using `AuthSession.get/set/clear/isLoggedIn`, `AuthEvents.emit/subscribe/unsubscribe` and `LoginModalEvents.open/close/subscribe/unsubscribe` through the same default imports. No call sites change.
- The `auth:changed` and `login-modal:toggle` events keep their names and payloads, and the `localStorage` / in-memory storage behaviour stays the same.
- The existing specs pass without changes, including every `spyOn(AuthSession|AuthEvents|LoginModalEvents, ...)`.

## Solution
Follow the #227 pattern (see `frontend/assets/js/client/AccountsClient.js`): replace each `export default class X { static m() {} }` with `const X = { m() {} }; export default X;`, using the same names, methods and JSDoc.

- None of the three classes has private static state. The module-scope constants (`STORAGE_KEY`, `memoryStorage`, `storage()`, `AUTH_CHANGED_EVENT`, `LOGIN_MODAL_TOGGLE_EVENT`) stay as they are.
- `AuthSession.isLoggedIn` must keep calling `AuthSession.get()` by name, not `this.get()`. That way a spy on `get` still takes effect and a detached call still works.
- Do not use `Object.freeze` or namespace imports, because Jasmine spies need writable properties.
- Remove the three `eslint-disable-next-line @typescript-eslint/no-extraneous-class` comments. Update the JSDoc text that says "a plain class with static methods" so it describes an object module.
- Keep the `@typescript-eslint/no-extraneous-class` stub in `frontend/eslint.config.mjs`. The helper classes (`AdminUsersHelper`, `HeaderHelper`, `AdminUserEditHelper`, `MyAccountHelper`, `AuthorizationRequestsHelper`) still reference it. Those helpers are out of scope here.
- Do not change the specs.

## Benefits
- Removes the 3 remaining Warning findings in the client layer.
- Completes the move of `frontend/assets/js/client/` to object modules started in #227, so the layer uses one consistent style.

## Verification

- `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` pass, and coverage does not drop.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.
