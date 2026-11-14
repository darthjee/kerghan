# Section rendering and page wiring

**Helper:** create `GithubHandleHelper.render(state, handlers)`, which renders a separate section/form titled "GitHub handle". Reuse `FormFieldsHelper` for the field, the submit alert and the success alert:
- a text input with the id prefix `my-account-github-handle`, and a **Save** button;
- the help text "Your public GitHub repositories are listed on the Repositories page. Leave empty to remove it.";
- the input and button are disabled while `loading`, while saving, or when `loadError` is set;
- `loadError` shows as the section's alert;
- `fieldError` shows inline on the input, `submitError` in the section's alert, and `successMessage` in the success alert.

**Page:** in `MyAccount.jsx`, keep the existing `useAccountEditForm` form exactly as is. Add the handle section below it, with its own `useState`, a `useMemo`-built `GithubHandleController`, and a `useEffect(() => buildLoadEffect(controller)(), [controller])`. Follow `Sessions.jsx`'s exported `buildLoadEffect`, so the effect can be tested without a renderer. Extract a small `GithubHandleSection` component if that keeps `MyAccount.jsx` simple. Update the `MyAccount` / `MyAccountController` JSDoc only where it now misleads; the main form is still not prefilled.

Specs (render layer, with `elementTree` / `renderedOutput`):
- the section renders with the help text and the Save button;
- the disabled states (loading, load error with its text);
- the inline field error, the submit alert and both success messages;
- `MyAccountSpec` shows both forms, and the load effect calls `load()` once;
- the main form's existing specs still pass, and its submit never includes `githubHandle` (covered by step 01 and `MyAccountControllerSpec`);
- the default-user case: the section works without any password field (no `currentPassword` input inside the section);
- the admin pages: `AdminUsersHelperSpec` and `AdminUserEditHelperSpec` each gain an assertion that no handle column or field (and no "GitHub handle" text) is rendered.

## Files to Change
- `frontend/assets/js/components/resources/accounts/pages/helpers/GithubHandleHelper.jsx` (new).
- `frontend/assets/js/components/resources/accounts/pages/MyAccount.jsx` — wire the section in (plus an optional `GithubHandleSection.jsx`).
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/GithubHandleHelperSpec.js` (new).
- `frontend/specs/assets/js/components/resources/accounts/pages/MyAccountSpec.js` — the section and the load effect.
- `frontend/specs/assets/js/components/resources/admin/pages/helpers/AdminUsersHelperSpec.js`, `AdminUserEditHelperSpec.js` — the no-handle assertions.
