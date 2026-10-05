# Render the checkbox on Password and device tabs

In `LoginModalFormsHelper.jsx`, render a Bootstrap `form-check` checkbox below the text fields and
above the submit button, only when the active mode is `password` or `device` (e.g. a
`KEEP_SIGNED_IN_MODES` set). Do not route it through `FormFieldsHelper.renderField`, which renders
`form-control` text inputs only.

```jsx
<div className="form-check mb-3">
  <input id="login-modal-keepSignedIn" type="checkbox" className="form-check-input"
    checked={Boolean(state.keepSignedIn)} onChange={handlers.onKeepSignedInChange} />
  <label className="form-check-label" htmlFor="login-modal-keepSignedIn">Keep me signed in</label>
</div>
```

The label is plain text, with no helper text. Update the `render` JSDoc for the new state and
handler. The checkbox does not appear while a result panel (e.g. device waiting) is shown, because
the form is replaced.

Specs: the checkbox renders on the Password and device modes, does not render on register, recover
or resetPassword, is unchecked when `keepSignedIn` is falsy, and is checked when it is `true`.

## Files to Change

- `frontend/assets/js/components/common/loginModal/helpers/LoginModalFormsHelper.jsx` — render the
  checkbox for the two modes.
- `frontend/specs/assets/js/components/common/loginModal/helpers/LoginModalFormsHelperSpec.js`
