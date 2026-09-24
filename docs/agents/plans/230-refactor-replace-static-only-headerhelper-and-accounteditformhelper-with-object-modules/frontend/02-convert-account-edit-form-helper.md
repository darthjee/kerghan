# Convert AccountEditFormHelper to an object module
Replace the static-only `AccountEditFormHelper` class with an object literal. It has no private methods, only `render`.

- Remove the `eslint-disable-next-line @typescript-eslint/no-extraneous-class` comment and its two continuation lines.
- `const AccountEditFormHelper = { render(state, handlers, options) { ... } };` then `export default AccountEditFormHelper;`. Keep the class-level and `render` JSDoc, the `PROFILE_FIELDS` / `PASSWORD_FIELDS` module constants, and the `FormFieldsHelper` import unchanged.

## Files to Change
- `frontend/assets/js/components/common/forms/helpers/AccountEditFormHelper.jsx`: convert the class to an object module.
