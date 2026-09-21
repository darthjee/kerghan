# Issue: Refactor: extract shared redirectHome/redirectIfForbidden helpers from frontend controllers

## Description
The "go to the home route" logic and the "redirect home on 403" logic are copy-pasted verbatim into five controllers and two components.

## Problem
- `#redirectHome()` (`if (typeof window === 'undefined') return; window.location.hash = '/';`) is duplicated in `AdminUsersController.js` (~line 102), `AdminUserEditController.js` (~173), `RegisterController.js` (~102), `LoginModalController.js` (~291) and `HeaderController.js` (~77); inline variants of `window.location.hash = '/'` exist in `ResetPasswordLanding.jsx` (`redirectToResetModal`) and `ModalRedirect.jsx` (`redirectToModal`).
- `#redirectIfForbidden(error)` (`error.status !== 403` → `false`, else redirect home and return `true`) is duplicated in `AdminUsersController.js` and `AdminUserEditController.js` (jscpd: 20 lines, `AdminUserEditController.js` 161-180 ↔ `AdminUsersController.js` 90-109).

## Expected Behavior
A single helper performs the SSR/spec-safe redirect home, and a second one implements the 403 → redirect rule; controllers and components call them. No behavior change.

## Solution
- Create a new module in `frontend/assets/js/utils/routing/` (next to `Router.js`, e.g. `redirects.js`) with two **named function exports**, matching the function-export style already used by `redirectToModal` / `redirectToResetModal`:
  - `redirectHome()` — no-op when `window` is undefined, otherwise sets `window.location.hash = '/'`.
  - `redirectIfForbidden(error)` — returns `false` when `error.status !== 403`; otherwise calls `redirectHome()` and returns `true`.
- Replace the seven copies (five controllers, `ResetPasswordLanding.jsx`, `ModalRedirect.jsx`) with calls to these helpers; `AdminUsersController` and `AdminUserEditController` use `redirectIfForbidden`, the rest use `redirectHome`.
- Update the doc comments that reference `RegisterController#redirectHome` (e.g. in `ApiClient.js` and `LoginModalController.js`) to point at the new helper.
- Specs: add specs for the new module (with and without `window`; 403 vs non-403 errors). Leave the existing controller/component specs untouched — they keep faking `window` and must keep passing unchanged, which proves there is no behavior change.

## Benefits
Removes seven copies of the same guard/assignment and gives routing behavior one place to change (for example, if hash routing is ever replaced).
