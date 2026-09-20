# Frontend Plan: Refactor: dedupe MyAccountHelperSpec and AdminUserEditHelperSpec

Main plan: [plan.md](plan.md)

## Overview
Both production helpers already delegate to `AccountEditFormHelper.render(...)` (#161), and the two controller specs already share `frontend/specs/support/accountEditFormControllerExamples.js` (#163). The two helper specs still repeat the same ~10 cases and the same `buildHandlers`/`buildState` builders. This plan applies the #163 pattern to them.

## Context
`MyAccountHelperSpec.js` and `AdminUserEditHelperSpec.js` differ only in the heading (`My Account` / `Edit User`), success message (`Account updated.` / `User updated.`), submit-error text, and the `currentPassword` handling (expected by My Account, absent for Admin). Neither asserts the input-id prefix (`my-account-` / `admin-user-edit-`) today. `AccountEditFormHelperSpec.js` covers the generic renderer with neutral values and stays untouched.

## Implementation Steps

### Step 1 — Add the shared example group
Create `frontend/specs/support/accountEditFormHelperExamples.js`, following the style of `accountEditFormControllerExamples.js` (JSDoc on every function, small `register…Examples` helpers to keep functions short, one exported entry point):

- Export `itBehavesLikeAnAccountEditFormHelper(options)`, to be called inside a `describe`. Options: `Helper` (class under test), `heading`, `successMessage`, `submitError` (text used for the submit-error alert case), `idPrefix`, `changeFields` (array of field names the change handler must be wired with; My Account passes the five names, Admin the four).
- Register `describe('.render', ...)` containing the cases currently duplicated: page heading; submit-error alert present / absent; success alert with the page's message / absent; current field values; inline field error / none; change handler wired per field in `changeFields`; form and `>Save<` button.
- New cases: inputs for `username`, `email`, `newPassword`, `newPasswordConfirmation` have ids `${idPrefix}<name>` (assert e.g. `id="my-account-username"`).
- Move `buildHandlers` and `buildState` (state always including `currentPassword: ''`, as today's My Account spec and `AccountEditFormHelperSpec` do) into the module and return them, together with a `renderHtml(state, handlers)` convenience wrapping `renderToStaticMarkup(Helper.render(...))`, so the page specs can reuse them for their own cases.

### Step 2 — Rewire the two page specs
- `MyAccountHelperSpec.js`: replace the duplicated cases and local builders with a call to `itBehavesLikeAnAccountEditFormHelper({ Helper: MyAccountHelper, heading: 'My Account', successMessage: 'Account updated.', submitError: 'Invalid current password', idPrefix: 'my-account-', changeFields: [...five names] })`. Keep the My Account-only expectations in its own `describe`: the `Current password` field is rendered (with id `my-account-currentPassword`) and `onChange('currentPassword')` is wired.
- `AdminUserEditHelperSpec.js`: same, with `Edit User` / `User updated.` / `Username already in use` / `admin-user-edit-` and the four `changeFields`. Keep the Admin-only negative case ("renders no current-password field, unlike MyAccount").
- Confirm the whole suite still passes and no case was lost: every removed `it` must map to a case in the shared group.

## Files to Change
- `frontend/specs/support/accountEditFormHelperExamples.js` — new shared example group (Step 1)
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/MyAccountHelperSpec.js` — call the shared group; keep `currentPassword` cases (Step 2)
- `frontend/specs/assets/js/components/resources/admin/pages/helpers/AdminUserEditHelperSpec.js` — call the shared group; keep the no-current-password case (Step 2)

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe npm run lint` (CI job: frontend lint — `npm run lint`)
- `frontend`: `docker-compose run --rm kerghan_fe npm test` (CI job: frontend tests — `npm run coverage`)

## Notes
- Run everything through `docker-compose` (project rule); do not invoke `yarn`/`npm` on the host.
- Pure test refactor: no production code changes. Do not touch `AccountEditFormHelperSpec.js`.
- The `support/` module is not a `*Spec.js` file, so jasmine does not load it as a spec on its own (same as `accountEditFormControllerExamples.js`); it must not be named `*Spec.js`.
- Import paths from the page specs to `specs/support/` are deep relative paths (compare the `../../../../../../../support/...` import in `MyAccountControllerSpec.js`); double-check the depth when editing.
- The shared `describe('.render')` and page-specific `describe`s can coexist; if the page-specific block is also named `.render`, give it a distinguishing name (e.g. `.render (current password)`) to keep failure output unambiguous.
- Optionally re-run jscpd (if available in the reviewer's environment) to confirm the four reported clones between the two specs are gone.
