# Issue: Refactor: dedupe MyAccountHelperSpec and AdminUserEditHelperSpec

## Description
The helper specs for My Account and Admin User Edit are near-copies (~40 duplicated lines), mirroring the (now already deduplicated) production helpers, which both delegate to `AccountEditFormHelper.render(...)`.

## Problem
jscpd finds four clones between `frontend/specs/assets/js/components/resources/accounts/pages/helpers/MyAccountHelperSpec.js` and `frontend/specs/assets/js/components/resources/admin/pages/helpers/AdminUserEditHelperSpec.js` (roughly the page heading, submit-error alert, success alert, field-values and inline-error cases, plus the `buildHandlers`/`buildState` builders). The cases differ only in the heading, success-message and submit-error strings, and the `currentPassword` handling (expected by My Account, absent for Admin). Neither spec currently asserts the input-id prefix.

## Expected Behavior
The rendering cases both pages share (page heading, submit-error alert, success alert, current field values, inline field errors, change-handler wiring, form/Save button, and input ids using the page's prefix) are defined once and run for both helpers. Page-specific expectations stay in each page's own spec.

## Solution
Following the precedent set by #163 (`frontend/specs/support/accountEditFormControllerExamples.js` / `itBehavesLikeAnAccountEditFormController`), add a shared example group in `frontend/specs/support/` (e.g. `accountEditFormHelperExamples.js` exporting `itBehavesLikeAnAccountEditFormHelper(options)`), parameterised by the helper under test, heading, success message, submit-error text, id prefix and the list of expected change-handler field names. Both `MyAccountHelperSpec.js` and `AdminUserEditHelperSpec.js` call it.

- The shared group also adds new assertions that each page's input ids use its own prefix (`my-account-` / `admin-user-edit-`); neither spec checks this today.
- `MyAccountHelperSpec.js` keeps the `currentPassword`-specific expectations (field rendered, `onChange('currentPassword')` wired).
- `AdminUserEditHelperSpec.js` keeps its Admin-only negative case (no `Current password` field).
- `AccountEditFormHelperSpec.js` is left as is; it covers the generic shared renderer with neutral values.

## Benefits
Halves the maintenance cost of the helper specs, keeps the two pages' rendering contract in lock-step, and closes the id-prefix coverage gap.
