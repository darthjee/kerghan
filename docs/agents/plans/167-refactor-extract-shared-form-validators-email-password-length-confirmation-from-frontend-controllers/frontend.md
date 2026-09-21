# Frontend Plan: Refactor: extract shared form validators (email, password length, confirmation) from frontend controllers

Main plan: [plan.md](plan.md)

## Overview
Add a validators module of plain exported functions (no class) under `frontend/assets/js/utils/validation/` and reuse it from `RegisterController`, `AccountEditFormController` and `LoginModalController`. Delete `ResetPasswordController` (only the modal uses it). Every message and every form's behavior stays byte-identical.

## Context
- Since #162, `MyAccountController` and `AdminUserEditController` inherit their validation from `AccountEditFormController` (`components/common/forms/controllers/`), so the issue's "four controllers" are really three: `RegisterController`, `ResetPasswordController`, `AccountEditFormController`.
- Current rules to preserve:
  - Register: username required (`Username is required`); email required (`Email is required`) then `EMAIL_PATTERN` (`Email is invalid`); password required (`Password is required`); confirmation required (`Password confirmation is required`) then must match when password is non-empty (`Passwords do not match`).
  - Reset password: same password/confirmation rules as Register, no username/email.
  - Account edit: email optional (blank = no error) then `EMAIL_PATTERN`; new password optional (blank = no error), else min `MIN_PASSWORD_LENGTH = 8` (`Password must be at least 8 characters`), else must equal confirmation (`Passwords do not match`, error on `newPasswordConfirmation`, also when confirmation is blank).
- `LoginModalController` today builds module-level shared instances (`registerValidator`, `resetPasswordValidator`) purely to call `validate()`.
- Agreed in discussion: plain functions; required/optional handling stays with the caller for the account-edit form; `ResetPasswordController` is deleted; `RegisterController.validate()` stays as the register page's public entry point.

## Steps

- [01 — Add validation module](frontend/01-add-validation-module.md)
- [02 — Use validators in RegisterController and AccountEditFormController](frontend/02-use-in-register-and-account-edit.md)
- [03 — Use validators in LoginModalController and remove ResetPasswordController](frontend/03-login-modal-and-remove-reset-controller.md)
- [04 — Update architecture docs](frontend/04-update-docs.md)

## CI Checks
- `frontend/`: `docker-compose run kerghan_fe yarn coverage` (CI job: `jasmine`)
- `frontend/`: `docker-compose run kerghan_fe yarn lint` (CI job: `frontend-checks`)

## Notes
- Never run `yarn`/`npm` directly on the host — always through `docker-compose` (see CLAUDE.md boundaries).
- Design refinement to flag: `LoginModalController` needs the full Register and Reset-password rule sets (including the "required" checks), and `RegisterController` needs the same Register set. So the module exposes two thin composite validators (`validateRegistration`, `validateResetPassword`) built from the primitives; "required vs optional" still stays with the caller for the account-edit form, which composes the primitives itself. This is what removes the 20-line Register/ResetPassword duplication without the modal re-declaring required checks.
- Keep the field-name parameter default-valued so callers with the standard names (`email`, `password`, `passwordConfirmation`) stay terse; `AccountEditFormController` passes `newPassword` / `newPasswordConfirmation`.
- Code style: JSDoc on every exported function (matches surrounding files); ESLint (airbnb-style) must pass.
- Verify no leftover references: `grep -rn "ResetPasswordController\|EMAIL_PATTERN\|MIN_PASSWORD_LENGTH" frontend/assets frontend/specs` should only hit the new module (and its spec).
