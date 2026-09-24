# Frontend Plan: Refactor: Replace static-only classes AuthSession, AuthEvents and LoginModalEvents with object modules

Main plan: [plan.md](plan.md)

## Overview
Rewrite `frontend/assets/js/client/AuthSession.js`, `AuthEvents.js` and `LoginModalEvents.js` from `export default class X { static m() {} }` to `const X = { m() {} }; export default X;`. Keep every name, method signature, JSDoc block and behaviour. Callers and specs stay untouched.

## Context
Codacy reports `@typescript-eslint/no-extraneous-class` on these three files, and the inline `eslint-disable-next-line` comments do not suppress it. Issue #227 already converted `ApiClient`, `AdminClient` and `AccountsClient` this way; use `frontend/assets/js/client/AccountsClient.js` as the reference shape: a JSDoc block on the `const`, JSDoc on each method, and methods separated by commas.

None of the three classes has private static state. Everything they rely on is already defined at module scope (`STORAGE_KEY`, `memoryStorage`, `storage()`, `AUTH_CHANGED_EVENT`, `LOGIN_MODAL_TOGGLE_EVENT`) and stays as is.

Many specs call `spyOn(AuthSession|AuthEvents|LoginModalEvents, '<method>')`, including the shared `frontend/specs/support/fetchSequence.js`. These only work if the exported object's properties are writable.

## Implementation Steps

### Step 1 — Convert AuthSession to an object module
In `AuthSession.js`, replace the class with `const AuthSession = { get() {...}, set(token) {...}, clear() {...}, isLoggedIn() {...} }; export default AuthSession;`.
- `isLoggedIn` must keep calling `AuthSession.get()` by name, not `this.get()`, so it keeps honouring spies on `get` and still works when called detached.
- Remove the `// eslint-disable-next-line @typescript-eslint/no-extraneous-class` comment and its continuation line.
- In the JSDoc, change "a plain class with static methods, matching {@link module:client/ApiClient}'s style" to describe a plain object module matching `ApiClient`.
- Do not use `Object.freeze`.

### Step 2 — Convert AuthEvents and LoginModalEvents to object modules
Apply the same transformation to `AuthEvents.js` (`emit(loggedIn, isAdmin = false)`, `subscribe(handler)`, `unsubscribe(handler)`) and `LoginModalEvents.js` (`open(mode, detail = {})`, `close()`, `subscribe(handler)`, `unsubscribe(handler)`).
- Keep event names and payload shapes byte-for-byte identical.
- Remove both eslint-disable comments and update the "plain class with static methods" wording in each JSDoc.
- The `{@link AuthEvents.subscribe}` / `{@link LoginModalEvents.subscribe}` references in the parameter docs can stay.

## Files to Change
- `frontend/assets/js/client/AuthSession.js` — class to object literal; drop the eslint-disable comment; update JSDoc wording.
- `frontend/assets/js/client/AuthEvents.js` — class to object literal; drop the eslint-disable comment; update JSDoc wording.
- `frontend/assets/js/client/LoginModalEvents.js` — class to object literal; drop the eslint-disable comment; update JSDoc wording.

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: `jasmine`); coverage must not drop.

## Notes
- Do **not** modify any spec. The existing specs are the regression check that the exported API is unchanged.
- Do **not** remove the `@typescript-eslint/no-extraneous-class` stub from `frontend/eslint.config.mjs`. The helper classes (`AdminUsersHelper`, `HeaderHelper`, `AdminUserEditHelper`, `MyAccountHelper`, `AuthorizationRequestsHelper`) still reference it, and they are out of scope.
- No `.codacy.yml` change is needed; none of these files has an exclusion there.
- Do not switch callers to namespace imports (`import * as`); keep the default imports.
