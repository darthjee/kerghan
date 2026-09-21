# Plan: Refactor: extract shared account-edit form hook from MyAccount.jsx and AdminUserEdit.jsx

Issue: [172-refactor-extract-shared-account-edit-form-hook-from-myaccount-jsx-and-adminuseredit-jsx.md](../../issues/172-refactor-extract-shared-account-edit-form-hook-from-myaccount-jsx-and-adminuseredit-jsx.md)

## Overview
Extract the duplicated state and controller wiring of `MyAccount.jsx` and `AdminUserEdit.jsx` into a shared `useAccountEditForm` hook. The work is entirely inside `frontend/`.

See [frontend.md](frontend.md) for the full plan.
