# Fix Register/add Recover in HeaderHelper

`HeaderHelper.render` (`frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx`)
currently renders the Register link unconditionally, outside the `isLoggedIn` branch
(line 24) — it never hides when logged in, despite the issue asking for
Login/Register/Logoff to all show/hide correctly. Move it into the logged-out branch,
alongside a new placeholder Recover link (points at a route that doesn't exist yet — the
actual recovery feature is out of scope, tracked in #36):

```jsx
static render(isLoggedIn, onLogout) {
  return (
    <Navbar bg="light" expand="md">
      <Container fluid>
        <Navbar.Brand href="#/">Kerghan</Navbar.Brand>
        <Navbar.Toggle aria-controls="header-navbar" />
        <Navbar.Collapse id="header-navbar">
          <Nav className="me-auto">
            {HeaderHelper.#renderAuthLinks(isLoggedIn, onLogout)}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

static #renderAuthLinks(isLoggedIn, onLogout) {
  if (isLoggedIn) {
    return <Nav.Link href="#" onClick={onLogout}>Logout</Nav.Link>;
  }

  return (
    <>
      <Nav.Link href="#/login">Login</Nav.Link>
      <Nav.Link href="#/register">Register</Nav.Link>
      <Nav.Link href="#/recover">Recover</Nav.Link>
    </>
  );
}
```

(Renamed from `#renderAuthLink` to `#renderAuthLinks` since it now returns more than one
link in the logged-out case — adjust the call site/name to whatever reads best, this is
a cosmetic detail.)

No registry/rule-matcher needed — kerghan has no roles, so a plain conditional is enough
(confirmed during discuss-issue).

## Files to Change

- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx` — move Register
  into the logged-out branch, add the Recover placeholder link.
- `frontend/specs/assets/js/components/common/header/helpers/HeaderHelperSpec.js` —
  update: logged-out render shows Login + Register + Recover, none of them when logged
  in; logged-in render shows Logout only.
