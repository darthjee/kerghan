# Add the LoginModal component

Build the rendering side under `components/common/loginModal/`:

- `hooks/useLoginModal.js` — exports `buildLoginModalEffect(controller, { setOpen, setMode })`
  (or equivalent state setters) as a plain, testable function mirroring
  `useAuthEffect.js`'s `buildAuthEffect` pattern: subscribes to `LoginModalEvents` on mount, tears
  the subscription down on unmount. Default-exports the `useLoginModal` hook that wraps it in a
  `useEffect`.
- `helpers/LoginModalHelper.jsx` — the Modal shell (mode selector + the active mode's sub-form),
  following the existing static-class-with-`#render*`-methods convention (see `LoginHelper.jsx`,
  `HeaderHelper.jsx`). Split into a second forms helper if this would exceed ~300 lines.
- `LoginModal.jsx` — thin component: uses `useLoginModal` for open/mode state, an instance of
  `LoginModalController` for behavior, and renders `LoginModalHelper`. Uses `react-bootstrap`'s
  `Modal`, imported via the same deep-import style already used elsewhere for `react-bootstrap`
  components (e.g. `HeaderHelper.jsx`'s `react-bootstrap/cjs/Navbar.js`-style imports) — this is
  the first use of `Modal` in the codebase, so there's no existing import to copy verbatim.

This step only builds and unit-tests the component in isolation; mounting it into `AppHelper` is
step 06.

## Files to Change

- `frontend/assets/js/components/common/loginModal/hooks/useLoginModal.js` — new file.
- `frontend/assets/js/components/common/loginModal/helpers/LoginModalHelper.jsx` — new file.
- `frontend/assets/js/components/common/loginModal/LoginModal.jsx` — new file.
- `frontend/specs/assets/js/components/common/loginModal/hooks/useLoginModalSpec.js` — new spec,
  mirrors `useAuthEffectSpec.js`.
- `frontend/specs/assets/js/components/common/loginModal/helpers/LoginModalHelperSpec.js` — new
  spec.
- `frontend/specs/assets/js/components/common/loginModal/LoginModalSpec.js` — new spec.
