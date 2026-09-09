# Issue: Frontend: login modal shell with Password and Register modes

## Description

Split from #58 (see that issue for the full design rationale and the complete sub-issue list).
Depends on nothing — it integrates against the already-shipped `POST /auth/login.json` and
`POST /auth/register.json`, so it can run in parallel with the backend sub-issues.

This lands the login modal as the single account-auth entry point, with its first two modes
(Password and Register), and removes the standalone `#/login` and `#/register` pages. Recovery
modes are #58 sub-issue 5; the device mode is #58 sub-issue 6; the Authorizations page is #58
sub-issue 7.

Reuse the existing pieces: `client/AccountsClient.js` (`login`, `register`), `client/AuthEvents.js`
(the `auth:changed` bus the header already listens to via `useAuthEffect.js`'s `buildAuthEffect`),
`client/AuthSession.js`, and the `buildAuthEffect` "extract the effect body as a testable plain
function" pattern in `components/common/header/hooks/useAuthEffect.js`. `react-bootstrap` 2.10.10
(`Modal`) is already a dependency and `bootstrap.bundle` JS is globally imported in `main.jsx` — no
new dependency, though no file currently imports `Modal` (or any `react-bootstrap` component),
so this is the first usage of that piece.

## Problem

- Login and registration are full-page navigations (`#/login` → `AppHelper` → `Login.jsx`), and
  `client/ApiClient.js` `#sessionExpired` hard-redirects to `#/login` on an unrecoverable `401`.
- `Login.jsx` / `Register.jsx` each carry a `pages/` + `controllers/` + `helpers/` trio plus
  specs, with the "submit → `AuthEvents.emit` → redirect" logic duplicated.
- There is no modal component and no shared bus for opening one from `ApiClient`, the header, or
  (later) the reset-link landing without prop-drilling or a React ref.

## Expected Behavior

- A single modal, mounted once (route-independent), opened via a new `client/LoginModalEvents.js`
  bus. The header's Login and Register controls call `onOpenLogin('password')` /
  `onOpenLogin('register')` instead of navigating.
- Mode selector inside the modal with (for now) **Password** and **Register**. Both submit
  through `AccountsClient` and converge on one shared success handler mirroring today's
  `LoginController.handleSubmit`: the refresh token is already persisted by the `AccountsClient`
  call, then `AuthEvents.emit(true, user.isAdmin)`, close the modal, `window.location.hash = '/'`.
- `client/ApiClient.js` `#sessionExpired` clears `AuthSession`, emits `auth:changed` `false`, and
  opens the modal in Password mode — no navigation. Opening the modal issues no API call (no
  loop).
- `#/login` and `#/register` bookmarks still resolve: a tiny redirect component opens the modal in
  the right mode and sends the route to `#/`.
- The standalone `Login.jsx` / `Register.jsx` pages no longer exist.
- The header's existing Recover-password link is untouched by this issue — it keeps navigating
  to the full-page `#/recover-password` flow until #58 sub-issue 5 folds it into the modal.
- Switching between Password and Register mode inside the modal resets the form: no field values
  carry over between modes.

## Solution

### Scope

The modal shell + Password + Register modes, the `LoginModalEvents` bus, mounting, header wiring,
the `ApiClient` redirect rework, route cleanup, and deletion of the two pages. Mirrored Jasmine
specs.

Explicitly **out of scope**:

- Recovery modes and the `#/recover-password` landing — #58 sub-issue 5. The header's
  Recover-password link keeps navigating to that full page for now.
- Device-authorization mode and the poller — #58 sub-issue 6.
- The Authorizations page and its header link — #58 sub-issue 7.
- Any backend change.

### What needs to be done

- New `frontend/assets/js/components/common/loginModal/`:
  - `LoginModal.jsx` — thin; `react-bootstrap` `Modal`, imported via the same deep-import style
    already used for `react-bootstrap` components elsewhere (e.g. `HeaderHelper.jsx`'s
    `react-bootstrap/cjs/Navbar.js`-style imports), not the bare package import — this is the
    first use of `Modal` in the codebase; holds `mode` state; open/close driven by
    `LoginModalEvents` via a hook.
  - `controllers/LoginModalController.js` — mode switching, per-mode submit, the shared success
    handler, submit-error state. Reuse `RegisterController`'s `validate()` (move it to a helper
    the modal controller composes, or keep the class as a pure validator).
  - `helpers/LoginModalHelper.jsx` — Modal shell + mode selector + the active mode's sub-form
    (split into a second forms helper if it would exceed 300 lines).
  - `hooks/useLoginModal.js` — `buildLoginModalEffect(...)` plain function (mirrors
    `buildAuthEffect`): subscribe to `LoginModalEvents`, tear down on unmount.
- New `frontend/assets/js/client/LoginModalEvents.js` — byte-for-byte mirror of `AuthEvents.js`;
  event `login-modal:toggle`; `open(mode, detail)` / `close()` / `subscribe(handler)` /
  `unsubscribe(handler)`.
- `frontend/assets/js/client/ApiClient.js` — `#sessionExpired` opens the modal
  (`LoginModalEvents.open('password')`) instead of `window.location.hash = '/login'`; drop the
  `LOGIN_HASH` constant; import `LoginModalEvents` (+ `AuthEvents`).
- `frontend/assets/js/utils/routing/HashRouteResolver.js` — remove `['/login','login']` and
  `['/register','register']` from `ROUTES`, mapping them instead to a new `ModalRedirect`
  component to preserve old-bookmark support.
- `frontend/assets/js/components/helpers/AppHelper.jsx` — mount `<LoginModal />` once as a sibling
  of `<Header>`; drop the `login` / `register` `PAGES` entries (or point them at
  `common/ModalRedirect.jsx`).
- `frontend/assets/js/components/common/header/` — `HeaderHelper.jsx` Login/Register links become
  `onClick={() => onOpenLogin('password' | 'register')}`; `Header.jsx` /
  `controllers/HeaderController.js` add `openLoginModal(mode)` → `LoginModalEvents.open(mode)`,
  passed down as `onOpenLogin`. `checkStatus()` / `handleLogout()` unchanged. The Recover-password
  link is left as a normal navigation link, unchanged.
- Delete `components/resources/accounts/pages/Login.jsx` (+ `helpers/LoginHelper.jsx`,
  `controllers/LoginController.js`) and `pages/Register.jsx` (+ `helpers/RegisterHelper.jsx`),
  and their specs (`LoginSpec.js`, `LoginHelperSpec.js`, `LoginControllerSpec.js`,
  `RegisterSpec.js`, `RegisterHelperSpec.js`). Keep `controllers/RegisterController.js` (or its
  `validate()`) and its spec, reused by the modal.
- Specs (Jasmine + c8), mirrored under `frontend/specs/`: `LoginModalSpec.js`,
  `LoginModalControllerSpec.js` (mode switching, each mode's submit, shared success handler),
  `LoginModalHelperSpec.js`, `LoginModalEventsSpec.js`, updated `ApiClientSpec.js` (`#sessionExpired`
  opens the modal), updated `HeaderHelperSpec.js` / `HeaderControllerSpec.js`, and updated
  `AppHelperSpec.js` for the `PAGES` map change.

### Acceptance criteria

- [ ] The header's Login and Register controls open one react-bootstrap modal (Password /
      Register modes) instead of navigating; `#/login` and `#/register` no longer render
      standalone pages (a redirect shim keeps old bookmarks working).
- [ ] Password and Register success both run one shared handler: `AuthSession` holds the refresh
      token, `AuthEvents.emit(true, isAdmin)` fires, the modal closes, the app navigates to `#/`.
- [ ] `client/ApiClient.js` opens the modal in Password mode on an unrecoverable `401` instead of
      redirecting to `#/login`, and opening the modal issues no API call.
- [ ] `client/LoginModalEvents.js` exists and mirrors `AuthEvents.js` (`open` / `close` /
      `subscribe` / `unsubscribe`).
- [ ] `LoginModal` is mounted once in `AppHelper`, independent of the current route.
- [ ] `Login.jsx` / `Register.jsx` pages and their specs are deleted; register validation logic
      is preserved and reused by the modal.
- [ ] The header's Recover-password link still navigates to the full-page `#/recover-password`
      flow, unchanged.
- [ ] Switching modes inside the modal resets the form fields (no carry-over between Password and
      Register).
- [ ] New/updated Jasmine specs pass; `docker-compose run --rm kerghan_fe yarn lint` and
      `docker-compose run --rm kerghan_tests yarn test` pass.

## Benefits

- Removes a full-page navigation from the login path and collapses two duplicated page trios into
  one modal with one success handler.
- Delivers the bus + mount + `ApiClient` rework that sub-issues 5, 6 and 7 all build on, against
  endpoints that already exist.
- Keeps the header integration free — it already reacts to `auth:changed`.
