# Frontend Plan: Frontend: password-recovery modes in the login modal

Main plan: [plan.md](plan.md)

## Overview

All work is inside `frontend/`. The #62 login modal
(`components/common/loginModal/`) already owns `password` / `register` modes, a
`MODE_TABS` selector, per-mode field tables, and a shared `LoginModalEvents` bus that
already merges arbitrary `detail` into its `login-modal:toggle` event. This plan adds two
more modes and their result panels, adds token plumbing from the bus to the modal, turns
`ResetPassword.jsx` into a redirect-only landing, deletes the `Recover.jsx` page trio, and
rewires routing + the header.

Key facts confirmed against the current code:

- `LoginModalEvents.open(mode, detail)` already ships `{ open: true, mode, ...detail }`, but
  `hooks/useLoginModal.js` forwards **only** `detail.mode` to `controller.switchMode(mode)` —
  a token carried in `detail` is dropped today.
- The modal's only success path, `LoginModalController.#handleSuccess`, unconditionally calls
  `LoginModalEvents.close()` + redirects home. `recover` / `resetPassword` must instead leave
  the modal open on a panel, so they need a new `resultPanel` state and must not reach
  `#handleSuccess`.
- `MODE_TABS`, `FIELDS_BY_MODE`, `SUBMIT_LABELS` live in
  `helpers/LoginModalFormsHelper.jsx`; `TITLES` lives in `helpers/LoginModalHelper.jsx`;
  `MODES` lives in `controllers/LoginModalController.js`. A new mode touches all of them.
- `#renderForm` in `LoginModalFormsHelper.jsx` hard-codes
  `state.mode === 'register' ? 'register' : 'password'` — any unknown mode currently collapses
  to the password form. This must become a lookup against the known modes.
- The token-from-hash parser is a module-private `getTokenFromHash` in `ResetPassword.jsx`
  (the file being slimmed), **not** in `ResetPasswordController`. It moves into
  `ResetPasswordLanding.jsx`.
- `ResetPasswordController.validate()` is an instance method that touches neither its setters
  nor its client — reuse it from the modal via a shared no-arg instance, mirroring the
  existing `registerValidator = new RegisterController(noop, noop)` in
  `LoginModalController.js`.
- `ModalRedirect` takes only `mode` (no `detail`), so it cannot back the
  `#/recover-password?token=…` landing — a dedicated `ResetPasswordLanding` component is
  required. The `recover` `PAGES` entry is removed outright (no `ModalRedirect` fallback),
  matching how #62 dropped `#/login` / `#/register`.
- ESLint enforces `complexity` ≤ 10, `max-depth` ≤ 4, ~300 lines/file, and JSDoc with
  `@param` / `@returns` / `@description` on public API. No `max-params` rule, but keep the
  `LoginModalController` constructor to one new setter (`setResultPanel`) — token state is
  owned by `LoginModal.jsx` and passed into `handleSubmit`.

## Steps

- [01 — Token + result-panel state in the modal shell](frontend/01-modal-token-and-result-state.md)
- [02 — Recover / resetPassword handlers in LoginModalController](frontend/02-controller-recover-reset-handlers.md)
- [03 — New modes, tabs, fields, and result panels in the helpers](frontend/03-helpers-modes-and-panels.md)
- [04 — ResetPasswordLanding + delete the Recover page trio](frontend/04-landing-and-recover-removal.md)
- [05 — Routing, PAGES, and header wiring](frontend/05-routing-pages-header.md)
- [06 — Specs: add, update, delete](frontend/06-specs.md)

## CI Checks

- `frontend/`: `docker-compose run --rm kerghan_fe yarn test` (CI job: `jasmine`, runs
  `npm run coverage`)
- `frontend/`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`,
  runs `npm run lint`)

Run both from the project root. Never run `yarn` / `npm` directly on the host.

## Notes

- **Enumeration safety**: `#submitRecover` must show the neutral panel in a `finally`, so a
  rejected `AccountsClient.recover` looks identical to success — same contract as the old
  `RecoverController.handleSubmit`.
- **No auto-login on reset**: `#submitResetPassword` must not call `AuthEvents.emit`,
  `LoginModalEvents.close`, or redirect. The success panel's "back to log in" link switches
  the modal to `password` mode via `onSelectMode('password')`.
- **`ResetPasswordController` slimming**: once `ResetPassword.jsx` is gone, nothing calls
  `handleSubmit` / `setResetDone`. Reduce the controller to `validate()` + its two private
  helpers, drop the constructor and the `AccountsClient` import, and trim
  `ResetPasswordControllerSpec.js` to match. This keeps the reused logic covered without dead
  code. Keep `validate()` an instance method for consistency with `RegisterController`.
- **Token for a stale `#/recover-password` with no `token` query param**: `getTokenFromHash`
  returns `null`; `open('resetPassword', { token: null })` still opens the mode and the
  backend rejects the empty token on submit, surfacing through `setSubmitError` — acceptable,
  no special-casing needed.
- **`switchMode` on every open**: `useLoginModal` calls it on each `open` event, so opening in
  `recover` after a previous panel was shown must clear `resultPanel`. Clearing is done in
  `LoginModal.jsx` (both the bus path via the hook and the tab-click path via `onSelectMode`).
- Out of scope (per the issue): any backend change, device-authorization mode (#58 sub-issue
  6), the Authorizations page (#58 sub-issue 7).
