# Plan: Refactor: extract shared form validators (email, password length, confirmation) from frontend controllers

Issue: [167-refactor-extract-shared-form-validators-email-password-length-confirmation-from-frontend-controllers.md](../../issues/167-refactor-extract-shared-form-validators-email-password-length-confirmation-from-frontend-controllers.md)

## Overview
Extract the client-side email/password validation rules (currently re-declared in `RegisterController`, `ResetPasswordController` and `AccountEditFormController`) into plain pure functions under `frontend/assets/js/utils/validation/`, and let `LoginModalController` use them directly.

See [frontend.md](frontend.md) for the full plan.
