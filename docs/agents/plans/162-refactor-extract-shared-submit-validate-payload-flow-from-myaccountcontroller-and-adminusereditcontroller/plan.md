# Plan: Refactor: extract shared submit/validate/payload flow from MyAccountController and AdminUserEditController

Issue: [162-refactor-extract-shared-submit-validate-payload-flow-from-myaccountcontroller-and-adminusereditcontroller.md](../../issues/162-refactor-extract-shared-submit-validate-payload-flow-from-myaccountcontroller-and-adminusereditcontroller.md)

## Overview
Pull the duplicated submit/validate/payload/apply-success flow out of `MyAccountController` and `AdminUserEditController` into a shared `AccountEditFormController` base class, and the duplicated "only include defined keys" spread out of `AccountsClient.updateAccount` / `AdminClient.editUser` into a `pickDefined` helper. Pure refactor — behavior of both pages is unchanged.

See [frontend.md](frontend.md) for the full plan.
