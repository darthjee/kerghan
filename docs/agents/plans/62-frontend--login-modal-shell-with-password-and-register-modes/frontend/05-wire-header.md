# Wire the header to open the modal

In `components/common/header/`:

- `controllers/HeaderController.js` — add `openLoginModal(mode)` that calls
  `LoginModalEvents.open(mode)`. `checkStatus()` and `handleLogout()` stay unchanged.
- `Header.jsx` — expose `openLoginModal` down to `HeaderHelper` as an `onOpenLogin` prop (or
  wire it the same way `checkStatus`/`handleLogout` are already threaded through).
- `helpers/HeaderHelper.jsx` — the Login and Register links stop navigating and instead call
  `onOpenLogin('password')` / `onOpenLogin('register')` respectively. The Recover-password link
  is untouched — it keeps its normal navigation to `#/recover-password`.

## Files to Change

- `frontend/assets/js/components/common/header/controllers/HeaderController.js` — add
  `openLoginModal(mode)`.
- `frontend/assets/js/components/common/header/Header.jsx` — pass `onOpenLogin` down.
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx` — Login/Register links
  call `onOpenLogin`.
- `frontend/specs/assets/js/components/common/header/controllers/HeaderControllerSpec.js` —
  add coverage for `openLoginModal(mode)` calling `LoginModalEvents.open(mode)`.
- `frontend/specs/assets/js/components/common/header/helpers/HeaderHelperSpec.js` — update the
  Login/Register link specs to assert `onOpenLogin` is called with the right mode instead of
  asserting on navigation; Recover-password link spec is unchanged.
