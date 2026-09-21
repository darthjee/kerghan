# Issue: Refactor: extract a captured-handlers helper for React page specs (AuthorizationRequests, AdminUsers, AdminUserEdit, MyAccount)

## Description
Several React page specs repeat the same "spy on Helper.render, capture the handlers, render the page" block in nearly every handler-delegation test. `MyAccountSpec.js` and `AdminUserEditSpec.js` also share a near-identical "passes the default state to the helper" test.

## Problem
Each handler-delegation test does:

```js
let capturedHandlers;
spyOn(SomeHelper, 'render').and.callFake((_state, handlers) => {
  capturedHandlers = handlers;
  return React.createElement('div');
});
renderToStaticMarkup(React.createElement(Page));
```

jscpd counts, under `frontend/specs/assets/js/components/resources/`:

- `accounts/pages/AuthorizationRequestsSpec.js` — 33 lines across 3 clones (e.g. 69-81 ↔ 86-98).
- `admin/pages/AdminUsersSpec.js` — 18 lines across 2 clones (e.g. 59-67 ↔ 28-53).
- `admin/pages/AdminUserEditSpec.js` — 9 lines (59-67 ↔ 31-39).
- `accounts/pages/MyAccountSpec.js` — 11 lines (54-64 ↔ 32-41), plus a 15-line clone with `AdminUserEditSpec.js` (18-32 ↔ 17-31), which is the "passes the default state to the helper" test (a `toHaveBeenCalledWith` on the default state and `objectContaining({ onSubmit, onChange })`).

## Expected Behavior
- A shared spec-support helper, e.g. `renderCapturingHandlers(Page, Helper)`, spies on `Helper.render`, renders `Page` and returns the `capturedHandlers`. Each test only states what it delegates and asserts.
- The duplicated "passes the default state to the helper" test in `MyAccountSpec.js` / `AdminUserEditSpec.js` is also shared, parametrized by what differs between the two (page, helper, default state — `MyAccount` has `currentPassword`, `AdminUserEdit` does not).

## Solution
Add `renderCapturingHandlers` under `frontend/specs/support/` (next to `accountEditFormControllerExamples.js`, `fakeWindow.js`, etc.) and migrate the four page specs to it. The helper only owns the spy + render + capture; per-test setup (controller spies, `installFakeWindow`, the fake `preventDefault` event, the controller `load` spies) stays in the tests.

Also extract the shared default-state assertion for the two account-edit page specs into spec support (an existing support file such as `accountEditFormHelperExamples.js`, or a new one — to be decided when planning).

Out of scope: the repeated `fakeEvent = { preventDefault: ... }` line and the repeated `spyOn(Controller.prototype, 'load')` lines.

Work is frontend-only, owned by the `frontend` agent.

## Benefits
Each test shrinks from ~12 lines of scaffolding to a couple, so the actual assertions stand out, and the default-state test is defined once for both account-edit pages.
