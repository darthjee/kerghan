# Add the useAccountEditForm hook
Create `useAccountEditForm({ initialFields, createController, submit })`, a default-exported hook:

- `useState` for `fields` (seeded from `initialFields`), `fieldErrors` (`{}`), `submitError` (`null`) and `success` (`false`).
- `useMemo(() => createController(setFields, setFieldErrors, setSubmitError, setSuccess), [])` for the controller — run-once, same as the pages do today. Add an `eslint-disable-next-line react-hooks/exhaustive-deps` with a short justification if the rule warns about `createController`.
- `onChange = (field) => (event) => setFields((current) => ({ ...current, [field]: event.target.value }))`.
- `onSubmit = (event) => { event.preventDefault(); return submit(controller, fields); }`.
- Return `{ state: { ...fields, fieldErrors, submitError, success }, handlers: { onSubmit, onChange } }`.

Write full JSDoc (description, `@param`, `@returns`) matching the style of `useAuthEffect.js` / `useLoginModal.js`.

## Files to Change
- `frontend/assets/js/components/common/forms/hooks/useAccountEditForm.js` — new hook.
