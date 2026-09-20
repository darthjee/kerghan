# Issue: Refactor: extract shared account-edit form renderer from MyAccountHelper/AdminUserEditHelper/LoginModalFormsHelper

## Description
`MyAccountHelper.jsx` and `AdminUserEditHelper.jsx` are near-copies of each other (the largest duplication in the repo, ~120 duplicated lines), and `LoginModalFormsHelper.jsx` repeats the same field/error rendering.

## Problem
Detected with jscpd (token-based clone detection):

- `frontend/assets/js/components/resources/accounts/pages/helpers/MyAccountHelper.jsx` lines 32-100 ↔ `frontend/assets/js/components/resources/admin/pages/helpers/AdminUserEditHelper.jsx` lines 33-100 — a 69-line clone, plus two more clones (34 and 17 lines) inside the same pair.
- `#renderSubmitError`, `#renderSuccess` and `#renderField` are identical apart from strings: heading (`My Account` / `Edit User`), success message (`Account updated.` / `User updated.`), the input-id prefix (`my-account-` / `admin-user-edit-`), and one extra `currentPassword` field in My Account. The `PROFILE_FIELDS` / `PASSWORD_FIELDS` constants are also duplicated verbatim.
- `frontend/assets/js/components/common/loginModal/helpers/LoginModalFormsHelper.jsx` lines 255-271 ↔ `AdminUserEditHelper.jsx` lines 90-106 — the same `#renderField`; `#renderSubmitError` is repeated there too (it has no success alert).
- One shape difference: the two page helpers wire change handlers as `handlers.onChange(name)` (curried), while `LoginModalFormsHelper` passes an already-resolved handler from its `onChangeByField` map.

## Expected Behavior
One shared form-rendering helper owns the field, error-alert and success-alert markup, and a shared account-edit form renderer owns the page body; the three helpers only supply their own strings/fields. Rendered HTML (ids, class names, ordering) is unchanged.

## Solution
Create a new `components/common/forms/helpers/` folder (mirroring the existing `common/<area>/helpers` layout, e.g. `header`, `loginModal`) containing:

- `FormFieldsHelper.jsx` — exposes `renderField`, `renderSubmitError` and `renderSuccess`. `renderField` takes the **resolved** change handler (the `LoginModalFormsHelper` shape) plus the input-id prefix, so it stays agnostic to how handlers are wired. The page helpers call `handlers.onChange(name)` at the call site.
- `AccountEditFormHelper.jsx` — the shared account-edit form renderer, taking heading, success message, input-id prefix and an optional extra-fields list (e.g. My Account's `currentPassword` block). It owns the `PROFILE_FIELDS` / `PASSWORD_FIELDS` constants and the whole `render()` body.

Update `MyAccountHelper`, `AdminUserEditHelper` (thin config wrappers over `AccountEditFormHelper`) and `LoginModalFormsHelper` (uses `FormFieldsHelper` for field and submit-error rendering) accordingly.

Specs: leave `MyAccountHelperSpec`, `AdminUserEditHelperSpec` and `LoginModalFormsHelperSpec` unchanged as regression proof that markup is identical, and add a spec for each new shared helper. Only touch the existing specs if they break for a reason unrelated to markup.

Owning agent: `frontend` (everything lives under `frontend/`).

Out of scope: the page components (`MyAccount.jsx`/`AdminUserEdit.jsx`) and controllers — tracked separately.

## Benefits
Removes the single biggest clone in the repo; a future change to field markup or error styling happens in one place instead of three.
