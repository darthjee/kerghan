# Plan: Refactor: extract shared account-edit form renderer from MyAccountHelper/AdminUserEditHelper/LoginModalFormsHelper

Issue: [161-refactor-extract-shared-account-edit-form-renderer-from-myaccounthelper-adminuseredithelper-loginmodalformshelper.md](../../issues/161-refactor-extract-shared-account-edit-form-renderer-from-myaccounthelper-adminuseredithelper-loginmodalformshelper.md)

## Overview
Extract the duplicated field / error-alert / success-alert markup and the shared account-edit page body out of `MyAccountHelper`, `AdminUserEditHelper` and `LoginModalFormsHelper` into a new `components/common/forms/helpers/` folder. Rendered HTML stays identical.

See [frontend.md](frontend.md) for the full plan.
