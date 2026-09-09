# Header "My account" dropdown

Add the "My account" `NavDropdown` — the header's first dropdown grouping — containing the new
Authorizations link, shown only when logged in. `Header.jsx`/`HeaderController.js` need no
changes: `HeaderHelper.render(isLoggedIn, isAdmin, onLogout, onOpenLogin)`'s signature and
call site are unchanged, only its internals change.

## What changes in `HeaderHelper.jsx`

- Import `NavDropdown` the same way the file already imports `Navbar`/`Nav`/`Container`:
  `import NavDropdown from 'react-bootstrap/cjs/NavDropdown.js';`.
- In `#renderAuthLinks` (the `isLoggedIn` branch), add a new
  `#renderMyAccountDropdown()` call alongside the existing `#renderAdminLink(isAdmin)` and the
  Logout link:

  ```jsx
  return (
    <>
      {HeaderHelper.#renderAdminLink(isAdmin)}
      {HeaderHelper.#renderMyAccountDropdown()}
      <Nav.Link href="#" onClick={onLogout}>Logout</Nav.Link>
    </>
  );
  ```

- New private method `#renderMyAccountDropdown()`, unconditional (always shown once logged in —
  unlike `#renderAdminLink`, it takes no `isAdmin`-style gate):

  ```jsx
  static #renderMyAccountDropdown() {
    return (
      <NavDropdown title="My account" id="my-account-dropdown">
        <NavDropdown.Item href="#/account/authorization-requests">Authorizations</NavDropdown.Item>
      </NavDropdown>
    );
  }
  ```

- Update the class-level JSDoc comment on `#renderAuthLinks` to mention the new dropdown, mirroring
  how it currently documents the Admin Users link.

## Files to Change

- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx` — add the
  `NavDropdown` import and `#renderMyAccountDropdown()` method as above.
- `frontend/specs/assets/js/components/common/header/helpers/HeaderHelperSpec.js` — add a case
  asserting the "My account" dropdown (and its "Authorizations" item, linking to
  `#/account/authorization-requests`) renders when `isLoggedIn` is `true`, and is absent when
  `false` — mirroring the existing brand-link/admin-link assertions in this file.
