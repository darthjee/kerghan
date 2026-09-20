# Add FormFieldsHelper
Create `FormFieldsHelper`, a static-methods-only class (same `eslint-disable` convention and JSDoc style as the existing helpers) exposing `renderField(name, type, label, state, onChange, idPrefix)`, `renderSubmitError(state)` and `renderSuccess(state, message)`. The bodies are lifted verbatim from the current `#renderField` / `#renderSubmitError` / `#renderSuccess`, except that the input id is `` `${idPrefix}${name}` `` and `value`/`onChange` come from `state[name]` / the `onChange` argument. Add a spec that renders each method with `renderToStaticMarkup` and asserts ids, `is-invalid` / `invalid-feedback` on errors, no error markup without one, and alert presence/absence.

## Files to Change
- `frontend/assets/js/components/common/forms/helpers/FormFieldsHelper.jsx` — new shared renderer for field, submit-error and success markup.
- `frontend/specs/assets/js/components/common/forms/helpers/FormFieldsHelperSpec.js` — new spec mirroring the source path.
