# Frontend Plan: Refactor: extract shared account-edit form renderer from MyAccountHelper/AdminUserEditHelper/LoginModalFormsHelper

Main plan: [plan.md](plan.md)

## Overview
`MyAccountHelper.jsx` and `AdminUserEditHelper.jsx` are near-copies (identical `#renderSubmitError`, `#renderSuccess`, `#renderField`, and duplicated `PROFILE_FIELDS` / `PASSWORD_FIELDS` constants), and `LoginModalFormsHelper.jsx` repeats `#renderField` and `#renderSubmitError`. Extract the shared markup into two new helpers under `frontend/assets/js/components/common/forms/helpers/`, following the existing static-class-with-static-methods convention (see the `eslint-disable` comment used by the current helpers), and turn the three existing helpers into thin callers. The rendered HTML (ids, class names, ordering, `key`s) must not change.

## Context
- Everything lives under `frontend/`, so the `frontend` agent owns the whole plan.
- Shape difference to bridge: the page helpers wire change handlers as `handlers.onChange(name)` (curried), while `LoginModalFormsHelper` passes a resolved handler from its `onChangeByField` map. The shared `renderField` takes the **resolved** handler (the `LoginModalFormsHelper` shape); page callers do `handlers.onChange(name)` at the call site.
- `LoginModalFormsHelper` has no success alert, so it only uses `renderField` and `renderSubmitError`.
- The only page-level differences between My Account and Admin User Edit are: heading (`My Account` / `Edit User`), success message (`Account updated.` / `User updated.`), input-id prefix (`my-account-` / `admin-user-edit-`), and My Account's extra `currentPassword` field, rendered inside the "Change password" section, before the new-password fields.

### Proposed API
```js
// FormFieldsHelper.jsx
FormFieldsHelper.renderField(name, type, label, state, onChange, idPrefix) // -> <div className="mb-3" key={name}>…
FormFieldsHelper.renderSubmitError(state)                                   // -> alert-danger | null
FormFieldsHelper.renderSuccess(state, message)                              // -> alert-success | null

// AccountEditFormHelper.jsx
AccountEditFormHelper.render(state, handlers, {
  heading,               // 'My Account' | 'Edit User'
  successMessage,        // 'Account updated.' | 'User updated.'
  idPrefix,              // 'my-account-' | 'admin-user-edit-'  (the `-` is part of the prefix, so ids stay `${idPrefix}${name}`)
  leadingPasswordFields, // optional [name, type, label][], rendered after the "Change password" heading and before the new-password fields; My Account passes the currentPassword field
})
```
`AccountEditFormHelper` owns `PROFILE_FIELDS` / `PASSWORD_FIELDS`; `LoginModalFormsHelper` passes `'login-modal-'` as its prefix.

## Steps

- [01 — Add FormFieldsHelper](frontend/01-add-form-fields-helper.md)
- [02 — Add AccountEditFormHelper](frontend/02-add-account-edit-form-helper.md)
- [03 — Refactor the three existing helpers](frontend/03-refactor-existing-helpers.md)

## CI Checks
- `frontend/`: `docker-compose run kerghan_fe yarn coverage` (CI job: `jasmine`)
- `frontend/`: `docker-compose run kerghan_fe yarn lint` (CI job: `frontend-checks`)

## Notes
- Never run `yarn`/`npm` directly on the host — always through `docker-compose` (project boundary).
- Existing specs `MyAccountHelperSpec`, `AdminUserEditHelperSpec`, `LoginModalFormsHelperSpec` must pass **unchanged**; they are the regression proof that markup is identical. Only touch them if they break for a reason unrelated to markup.
- Out of scope: the page components (`MyAccount.jsx` / `AdminUserEdit.jsx`) and their controllers.
- Private `#` methods can't be reached from specs; the new helpers expose their methods as public statics so they can be unit-tested directly.
