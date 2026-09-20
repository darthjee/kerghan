# Issue: Refactor: extract shared submit/validate/payload flow from MyAccountController and AdminUserEditController

## Description
`MyAccountController.js` and `AdminUserEditController.js` implement the same form-submit flow twice, differing only in a few details (~75 duplicated lines). The two constructors (`setFields, setFieldErrors, setSubmitError, setSuccess, client`) are already identical in shape.

## Problem
Detected with jscpd:

- `frontend/assets/js/components/resources/accounts/pages/controllers/MyAccountController.js` ↔ `frontend/assets/js/components/resources/admin/pages/controllers/AdminUserEditController.js`: clones at 98-133/90-124 (36 lines), 46-66 (21 lines) and 139-156/127-144 (18 lines).
- Shared logic: `handleSubmit` (validate → skip when nothing is filled in → build payload → call client → apply success/set error), `validate` (email + new password + confirmation), `#buildPayload` (only include fields the user filled in, by truthiness, never `newPasswordConfirmation`), `#hasUpdate`, `#applySuccess` (reflect the response back into the form, clear password fields).
- Genuine differences: My Account requires `currentPassword` (extra validation, always in the payload, cleared on success), calls `AccountsClient.updateAccount(payload)` and returns `{username,email}`; Admin Edit takes a `userId`, calls `AdminClient.editUser(userId, payload)`, returns `{user: {username,email}}` and redirects home on `403`.
- The client layer repeats the "only include a key when defined" (`!== undefined`) payload spread too: `AccountsClient.updateAccount` (`client/AccountsClient.js`) and `AdminClient.editUser` (`client/AdminClient.js`).

## Expected Behavior
The submit flow lives in one place; each controller supplies only what differs (extra validation, client call, response mapping, error handling). Behavior of both pages is unchanged.

## Solution
- Extract a shared base class (e.g. `AccountEditFormController`) that owns the constructor, `handleSubmit`, `validate`, `buildPayload`, `hasUpdate` and `applySuccess`. Subclasses override small hooks for what differs (extra validation such as the required current password, the client call, mapping the response to `{username,email}`, submit-error handling such as the admin `403` redirect, which fields get cleared on success). Because JS `#private` methods cannot be called from a subclass, the hook methods become regular (non-`#`) methods.
- Add a shared "only include keys that are `!== undefined`" helper (e.g. `pickDefined`) under `frontend/assets/js/client/`, used by `AccountsClient.updateAccount` and `AdminClient.editUser`. The controllers' truthiness filtering (blank string = not filled in) stays in the shared controller base, so behavior is unchanged.
- Scope boundary: this issue does **not** touch the validator extraction (#167), the `redirectHome`/`redirectIfForbidden` extraction (#168), the account-edit React hook for the `.jsx` pages (#172) or the spec dedupe (#163). `validate` and the `403` redirect stay as-is (or as subclass hooks) so those issues can land in any order and later just replace the hook bodies.
- Owning agent: `frontend` (everything lives under `frontend/`).

## Benefits
One implementation of the most complex frontend form flow instead of two; fixes such as validation messages no longer need to be applied twice.
