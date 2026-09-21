# Issue: Refactor: extract shared account-edit form hook from MyAccount.jsx and AdminUserEdit.jsx

## Description
The two account-edit page components (`MyAccount.jsx` and `AdminUserEdit.jsx`) repeat the same React state and controller wiring.

## Problem
jscpd: `frontend/assets/js/components/resources/accounts/pages/MyAccount.jsx` lines 31-42 ↔ `frontend/assets/js/components/resources/admin/pages/AdminUserEdit.jsx` lines 44-55 (12 lines) and 25-31 ↔ 38-44 (7 lines).

Both pages keep `fields`/`fieldErrors`/`submitError`/`success` in `useState`, memoise a controller built from the four setters, and define the same `onChange` handler and an `onSubmit` handler that calls `event.preventDefault()` and delegates to `controller.handleSubmit(...)`. They differ only in:
- the initial fields (`MyAccount` also has `currentPassword`);
- the controller class and the helper used to render;
- the `handleSubmit` arguments (`AdminUserEdit` passes the route's `userId` first).

## Expected Behavior
A shared hook (e.g. `useAccountEditForm`) owns the four pieces of state, the memoised controller and the `onChange`/`onSubmit` wiring. Each page only supplies its initial fields, a controller factory and a submit adapter. Rendered output, handler behavior and the existing page specs stay unchanged.

## Solution
- Add `useAccountEditForm` under `frontend/assets/js/components/common/forms/hooks/`, next to the shared `AccountEditFormController` and `AccountEditFormHelper` from #161/#162 (mirroring the existing `common/header/hooks` and `common/loginModal/hooks` folders).
- The hook takes `{ initialFields, createController, submit }`: `createController(setFields, setFieldErrors, setSubmitError, setSuccess)` builds the controller (memoised once), and `submit(controller, fields)` is the per-page adapter that calls the controller's own `handleSubmit`. It returns the render state (`{ ...fields, fieldErrors, submitError, success }`) and the handlers (`{ onSubmit, onChange }`), ready to pass straight to `Helper.render(state, handlers)`.
- `MyAccount.jsx` and `AdminUserEdit.jsx` call the hook and keep only their genuinely different parts. `AdminUserEdit.jsx` keeps its SSR/spec-safe `currentHash()` route-param lookup for `userId` and closes over it in its submit adapter.
- `MyAccountController` and `AdminUserEditController` keep their current `handleSubmit` signatures — unifying them is out of scope.
- Add a spec for the hook (rendered through `renderToStaticMarkup`, as the page specs do) covering initial state, `onChange` and `onSubmit` (`preventDefault` plus delegation to the adapter). The existing `MyAccountSpec`/`AdminUserEditSpec` keep passing unchanged.

## Benefits
Pages shrink to their genuinely different parts, and a third account-edit page would reuse the hook instead of copying it.
