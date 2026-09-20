# Refactor the three existing helpers
- `MyAccountHelper.render` and `AdminUserEditHelper.render` delegate to `AccountEditFormHelper.render(state, handlers, {...})` with their own heading / success message / id prefix; `MyAccountHelper` also passes `leadingPasswordFields: [['currentPassword', 'password', 'Current password']]`. Remove their now-unused `PROFILE_FIELDS`, `PASSWORD_FIELDS`, `#renderSubmitError`, `#renderSuccess` and `#renderField`. Keep the class docblocks (adjust wording where they describe the moved markup).
- `LoginModalFormsHelper` drops its `#renderSubmitError` and `#renderField` and calls `FormFieldsHelper.renderSubmitError(state)` and `FormFieldsHelper.renderField(name, type, label, state, onChangeByField[name], 'login-modal-')` from `#renderForm`.
- Run the full Jasmine suite and lint; the three existing helper specs must pass unchanged.

## Files to Change
- `frontend/assets/js/components/resources/accounts/pages/helpers/MyAccountHelper.jsx` — thin wrapper over `AccountEditFormHelper`.
- `frontend/assets/js/components/resources/admin/pages/helpers/AdminUserEditHelper.jsx` — thin wrapper over `AccountEditFormHelper`.
- `frontend/assets/js/components/common/loginModal/helpers/LoginModalFormsHelper.jsx` — use `FormFieldsHelper` for field and submit-error rendering.
