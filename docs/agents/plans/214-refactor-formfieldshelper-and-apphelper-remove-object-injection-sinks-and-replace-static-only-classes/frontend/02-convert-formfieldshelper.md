# Convert FormFieldsHelper to an object module with guarded field reads

Add a private, non-exported, module-level function, for example:

```js
function readField(source, name) {
  return source && Object.hasOwn(source, name) ? source[name] : undefined;
}
```

It must tolerate an `undefined`/`null` `source`, because `state.fieldErrors` can be missing. Use `readField(state.fieldErrors, name)` for the error and `readField(state, name)` for the input value. Check that the guarded bracket read inside `readField` does not itself trigger `security/detect-object-injection` in `yarn lint`. If it does, use an equivalent form the rule accepts, such as `Object.getOwnPropertyDescriptor(source, name)?.value`, rather than adding a suppression.

Replace the class with a plain object literal `const FormFieldsHelper = { renderField(…), renderSubmitError(state), renderSuccess(state, message) }; export default FormFieldsHelper;`, keeping the method names, signatures, and JSDoc. Remove the `eslint-disable-next-line @typescript-eslint/no-extraneous-class` directive together with its explanatory comment lines.

## Files to Change
- `frontend/assets/js/components/common/forms/helpers/FormFieldsHelper.jsx`: `readField` helper, object-literal export, no disable directive.
