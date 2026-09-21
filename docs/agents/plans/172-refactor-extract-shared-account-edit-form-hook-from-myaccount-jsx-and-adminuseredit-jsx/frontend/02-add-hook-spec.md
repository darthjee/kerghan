# Add the hook spec
Spec the hook the same way the page specs exercise React: render a small probe component through `renderToStaticMarkup` (from `react-dom/server`) that calls `useAccountEditForm` and captures the returned `{ state, handlers }`. Cover:

- Initial `state` equals the given `initialFields` plus `fieldErrors: {}`, `submitError: null`, `success: false`.
- `createController` is called once with the four state setters (functions), and the controller it returns is what `submit` receives.
- `onChange(field)(event)` does not throw and does not call `submit`.
- `onSubmit(event)` calls `event.preventDefault()`, then `submit(controller, fields)` with the current fields, and returns its result.

Use `jasmine.createSpy` for `createController`/`submit`; follow the layout and relative-import depth of `specs/assets/js/components/common/loginModal/hooks/useLoginModalSpec.js`.

## Files to Change
- `frontend/specs/assets/js/components/common/forms/hooks/useAccountEditFormSpec.js` — new spec.
