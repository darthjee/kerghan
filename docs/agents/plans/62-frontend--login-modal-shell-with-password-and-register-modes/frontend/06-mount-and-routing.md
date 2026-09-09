# Mount the modal and clean up routing

- `components/helpers/AppHelper.jsx` — mount `<LoginModal />` once as a sibling of `<Header>`,
  route-independent.
- New `components/common/ModalRedirect.jsx` — a tiny component that, on mount, calls
  `LoginModalEvents.open(mode)` for a `mode` prop and sets `window.location.hash = '/'`. This is
  genuinely new (no existing redirect/modal component to model it on beyond the general
  static-class-with-render convention).
- `utils/routing/HashRouteResolver.js` — remove `['/login', 'login']` and
  `['/register', 'register']` from `ROUTES`.
- `components/helpers/AppHelper.jsx` — replace the `login` / `register` entries in `PAGES` with
  `<ModalRedirect mode="password" />` / `<ModalRedirect mode="register" />` respectively, so old
  `#/login` / `#/register` bookmarks still resolve into the modal.

## Files to Change

- `frontend/assets/js/components/helpers/AppHelper.jsx` — mount `LoginModal`; update `PAGES`.
- `frontend/assets/js/components/common/ModalRedirect.jsx` — new file.
- `frontend/assets/js/utils/routing/HashRouteResolver.js` — remove the two `ROUTES` entries.
- `frontend/specs/assets/js/components/helpers/AppHelperSpec.js` — update for the `PAGES` map
  change (`login`/`register` now render `ModalRedirect`) and assert `LoginModal` is mounted.
- `frontend/specs/assets/js/components/common/ModalRedirectSpec.js` — new spec: mounting opens
  the modal in the given mode and navigates to `#/`.
- `frontend/specs/assets/js/utils/routing/HashRouteResolverSpec.js` — update/remove the
  `/login` and `/register` route-resolution assertions, if any exist there.
