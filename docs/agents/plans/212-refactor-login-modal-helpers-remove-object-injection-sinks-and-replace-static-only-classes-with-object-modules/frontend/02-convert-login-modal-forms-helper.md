# Convert LoginModalFormsHelper
In `LoginModalFormsHelper.jsx`:

- Turn `FIELDS_BY_MODE`, `SUBMIT_LABELS` and `DEVICE_PANEL_MESSAGES` into `Map`s (`MODE_TABS` is already an array — leave it).
- Move every `static #…` private method (`#renderResultPanel`, `#renderDevicePanel`, `#formatCountdown`, `#renderModeSelector`, `#renderForm`) to a non-exported module-level function of the same name without `#` (e.g. `renderForm`), keeping each JSDoc, and update internal calls from `LoginModalFormsHelper.#x(...)` to `x(...)`.
- In `renderDevicePanel`: `DEVICE_PANEL_MESSAGES.get(panel)`.
- In `renderForm`:
  - `const mode = FIELDS_BY_MODE.has(state.mode) ? state.mode : 'password';`
  - `onChangeByField` becomes a `Map` of field name → handler, read with `onChangeByField.get(name)`.
  - `FIELDS_BY_MODE.get(mode).map(...)` and `SUBMIT_LABELS.get(mode)`.
- Replace the class with `const LoginModalFormsHelper = { render(state, handlers) { ... } }; export default LoginModalFormsHelper;`, keeping the JSDoc.
- Remove the `eslint-disable-next-line @typescript-eslint/no-extraneous-class` comment block and update the JSDoc sentence about the static-class convention, as in step 01.
- Run the existing `LoginModalFormsHelperSpec.js` / `LoginModalHelperSpec.js` / `LoginModalSpec.js`. They should pass unchanged. If coverage shows a newly uncovered branch (e.g. the unknown-mode fallback), add a spec for it.

## Files to Change
- `frontend/assets/js/components/common/loginModal/helpers/LoginModalFormsHelper.jsx` — Map lookups, module-level functions, object-literal export, suppression and JSDoc cleanup.
- `frontend/specs/assets/js/components/common/loginModal/helpers/LoginModalFormsHelperSpec.js` — only if needed to keep coverage from dropping.
