# Auth-aware Header

Lift `Header.jsx`'s current "auth-awareness is explicitly out of scope" note: the nav shows a
Login link when logged out and a Logout action when logged in, using `AuthSession.isLoggedIn()`
(from [step 01](01-auth-client-and-token-storage.md)) read directly at render time — no context
provider, consistent with this codebase's existing no-global-state style (see
[frontend.md](../frontend.md)'s Notes).

- `frontend/assets/js/components/common/header/Header.jsx` — drop the "auth-awareness out of
  scope" docstring note; pass `AuthSession.isLoggedIn()` and a logout handler down to
  `HeaderHelper.render`.
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx` — render
  `<Nav.Link href="#/login">Login</Nav.Link>` when logged out, or a Logout `<Nav.Link>`
  (`onClick`, `href="#"` to avoid an actual navigation) when logged in.
- Logout handler (in `Header.jsx` or a small `HeaderController.js` if the logic grows beyond a
  one-liner — follow whichever of the two existing patterns in this codebase best fits once
  written): calls `AccountsClient.logout(AuthSession.get())`, then redirects to home
  (`window.location.hash = '/'`) regardless of whether the request succeeded, since
  `AccountsClient.logout` already clears `AuthSession` unconditionally (per
  [step 01](01-auth-client-and-token-storage.md)).

## Files to Change

- `frontend/assets/js/components/common/header/Header.jsx` — auth-aware props, drop stale
  docstring note
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx` — conditional
  Login/Logout nav link
- `frontend/specs/assets/js/components/common/header/HeaderSpec.js` — cover logged-in vs.
  logged-out rendering and the logout action
- `frontend/specs/assets/js/components/common/header/helpers/HeaderHelperSpec.js` — cover both
  rendered states
