# Migrate both controllers onto the base class
Make `MyAccountController` and `AdminUserEditController` extend `AccountEditFormController`, deleting the duplicated constructor, `#buildPayload`, `#hasUpdate`, `#applySuccess` and email/new-password validators. Keep their public signatures untouched.

- `MyAccountController` — `client = AccountsClient` default passed through `super(...)`; `handleSubmit(fields)` → `this.submit(fields, (payload) => this.client.updateAccount(payload))`; override `validate` to merge the current-password check with `super.validate(fields)`; override `buildPayload` to add `currentPassword`; override `clearedFields` to also clear `currentPassword`.
- `AdminUserEditController` — `client = AdminClient` default; `handleSubmit(userId, fields)` → `this.submit(fields, (payload) => this.client.editUser(userId, payload))`; override `extractAccount` to return `result.user`; override `handleSubmitError` to keep the `403` → redirect-home behavior (keep the existing `#redirectIfForbidden`/`#redirectHome` private helpers as-is — #168 will replace them), falling back to `super.handleSubmitError(error)`.
- Trim the class-level JSDoc to what is still specific to each page; the `.jsx` pages (`MyAccount.jsx`, `AdminUserEdit.jsx`) and the existing controller specs need no changes — run them unchanged as the regression check.
- Update `docs/agents/architecture/frontend.md`'s directory layout to mention `components/common/forms/controllers/AccountEditFormController.js` and `client/pickDefined.js`.

## Files to Change
- `frontend/assets/js/components/resources/accounts/pages/controllers/MyAccountController.js` — extend the base class, keep only the current-password specifics
- `frontend/assets/js/components/resources/admin/pages/controllers/AdminUserEditController.js` — extend the base class, keep only `userId`/`{user}`/403-redirect specifics
- `docs/agents/architecture/frontend.md` — directory layout mentions the two new files
