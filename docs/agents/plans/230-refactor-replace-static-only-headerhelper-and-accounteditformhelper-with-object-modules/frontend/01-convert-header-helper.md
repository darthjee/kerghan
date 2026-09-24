# Convert HeaderHelper to an object module
Replace the static-only `HeaderHelper` class with an object literal. Rendered markup and click behaviour must not change.

- Remove the `eslint-disable-next-line @typescript-eslint/no-extraneous-class` comment and its continuation line.
- Move the four `static #renderX` private methods out of the class. They become non-exported module-level functions, keeping their JSDoc and bodies: `renderAuthLinks(isLoggedIn, isAdmin, onLogout, onOpenLogin)`, `renderLoginLink(mode, label, onOpenLogin)`, `renderAdminLink(isAdmin)` and `renderMyAccountDropdown()`. Define them above the `HeaderHelper` object, as in #229.
- Replace the `HeaderHelper.#renderX(...)` calls with plain `renderX(...)` calls.
- `const HeaderHelper = { render(isLoggedIn, isAdmin, onLogout, onOpenLogin) { ... } };` then `export default HeaderHelper;`. Keep `render`'s JSDoc and the class-level "Rendering helper for the Header element." doc on the object.
- In `renderMyAccountDropdown`'s JSDoc, change `{@link HeaderHelper.#renderAdminLink}` to `{@link renderAdminLink}`.

## Files to Change
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx`: convert the class to an object module and move the private methods to module-level functions.
