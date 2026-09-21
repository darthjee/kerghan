# Issue: Refactor: extract shared form validators (email, password length, confirmation) from frontend controllers

## Description
Email/password validation rules and constants are re-declared across several frontend controllers, so any rule change must be applied in several places.

## Problem
- `EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/` is declared in `RegisterController.js` and `AccountEditFormController.js` (the base class shared by `MyAccountController` and `AdminUserEditController` since #162).
- `MIN_PASSWORD_LENGTH = 8` and its message (`Password must be at least 8 characters`) live in `AccountEditFormController.js`.
- `#validatePassword` and `#validatePasswordConfirmation` (`'Password is required'`, `'Password confirmation is required'`, `'Passwords do not match'`) are repeated verbatim in `RegisterController.js` and `ResetPasswordController.js`; `AccountEditFormController.js` has a third variant for the new-password fields (optional, plus length check).
- `LoginModalController.js` instantiates `RegisterController`/`ResetPasswordController` only to call their pure `validate()` (see its comments near lines 32-40), which shows the validators are already logically shared.

Controllers live under `frontend/assets/js/components/`.

## Expected Behavior
One module exports the email pattern, the minimum password length and the rules every form shares — email format, minimum password length and password/confirmation match — as plain pure functions (`validateEmail`, `validatePassword`, `validatePasswordConfirmation`, parameterised by field name where needed). Whether a field is required or optional stays in each controller (Register/ResetPassword require it; the account-edit form treats an empty new password as "unchanged"). Messages and behavior of every form stay identical.

## Solution
- Add plain exported functions (no class) under `frontend/assets/js/utils/validation/`, with their own spec.
- Use them from `RegisterController`, `ResetPasswordController` (until removed, see below) and `AccountEditFormController`, each keeping its own required/optional handling.
- `LoginModalController` calls the validators directly instead of instantiating other controllers; `ResetPasswordController` (used only by the modal) is then deleted, with its spec coverage moved into the validators' spec. `RegisterController.validate()` stays as the register page's public entry point.

## Benefits
A single source of truth for client-side validation rules, kept in sync with the backend limits in one place.
