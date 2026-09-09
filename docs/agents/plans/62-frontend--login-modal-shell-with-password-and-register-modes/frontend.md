# Frontend Plan: Frontend: login modal shell with Password and Register modes

Main plan: [plan.md](plan.md)

## Steps

- [01 — Add LoginModalEvents bus](frontend/01-add-login-modal-events.md)
- [02 — Add LoginModalController](frontend/02-add-login-modal-controller.md)
- [03 — Add the LoginModal component](frontend/03-add-login-modal-component.md)
- [04 — Wire ApiClient's session-expired handling to the modal](frontend/04-wire-api-client.md)
- [05 — Wire the header to open the modal](frontend/05-wire-header.md)
- [06 — Mount the modal and clean up routing](frontend/06-mount-and-routing.md)
- [07 — Delete the standalone Login/Register pages](frontend/07-delete-old-pages.md)

## CI Checks

- `frontend`: `yarn lint` (CI job: `frontend-checks`) — locally: `docker-compose run --rm kerghan_fe yarn lint`
- `frontend`: `npm run coverage` / `npm test` (CI job: `jasmine`) — locally: `docker-compose run --rm kerghan_tests yarn test`

## Notes

- Follow the existing static-class-with-render/private-`#render*`-methods pattern (`LoginHelper`,
  `HeaderHelper`) for `LoginModalHelper`.
- `react-bootstrap`'s `Modal` has no existing usage anywhere in the codebase — import it via the
  same deep-import style already used for other `react-bootstrap` components (e.g.
  `HeaderHelper.jsx`'s `react-bootstrap/cjs/Navbar.js`-style imports), not the bare package import.
- Switching between Password and Register mode inside the modal resets the form — no field values
  carry over between modes (confirmed during issue discussion).
- The header's Recover-password link is untouched by this issue; it keeps navigating to the
  full-page `#/recover-password` flow.
- Steps 01–03 create new code with no dependents yet, so they can be built and unit-tested in
  isolation before steps 04–06 wire them in; step 07 (deletion) should land last, after everything
  that replaces the old pages is in place and passing.
