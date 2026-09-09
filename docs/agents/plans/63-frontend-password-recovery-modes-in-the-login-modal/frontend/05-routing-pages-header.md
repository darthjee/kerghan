# Routing, PAGES, and header wiring

Drop the standalone `#/recover` route, point `reset-password` at the new landing, and rewire
the header's Recover control through the modal.

## What to do

### `utils/routing/HashRouteResolver.js`

- Remove `['/recover', 'recover'],` from `ROUTES`. Keep `['/recover-password', 'reset-password']`.
  A stale `#/recover` bookmark now falls through to `['/', 'home']`, the same way #62 left
  `#/login` / `#/register` falling back to home.

### `components/helpers/AppHelper.jsx`

- Replace `import ResetPassword from '../resources/accounts/pages/ResetPassword.jsx';` with
  `import ResetPasswordLanding from '../resources/accounts/pages/ResetPasswordLanding.jsx';`.
- Remove `import Recover from '../resources/accounts/pages/Recover.jsx';`.
- In `PAGES`: remove the `recover: <Recover />` entry; change
  `'reset-password': <ResetPassword />` to `'reset-password': <ResetPasswordLanding />`.
- `PAGES.login` / `PAGES.register` (→ `ModalRedirect`) stay as they are — out of scope.

### `components/common/header/helpers/HeaderHelper.jsx`

- In `#renderAuthLinks`, replace `<Nav.Link href="#/recover">Recover</Nav.Link>` with
  `{HeaderHelper.#renderLoginLink('recover', 'Recover', onOpenLogin)}` so Recover opens the
  modal (with `preventDefault`) the same way Login / Register already do — `onOpenLogin`
  already takes a mode argument and `HeaderController.openLoginModal` already forwards it to
  `LoginModalEvents.open`.
- Update the JSDoc `@param onOpenLogin` mode-string mentions in `render`, `#renderAuthLinks`,
  and `#renderLoginLink` to include `'recover'`.

## Files to Change

- `frontend/assets/js/utils/routing/HashRouteResolver.js` — delete the `['/recover','recover']`
  route entry.
- `frontend/assets/js/components/helpers/AppHelper.jsx` — swap the `ResetPassword` import for
  `ResetPasswordLanding`, drop the `Recover` import, remove `PAGES.recover`, repoint
  `PAGES['reset-password']`.
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx` — route the Recover
  link through `#renderLoginLink('recover', …)`; refresh the mode-string JSDoc.
