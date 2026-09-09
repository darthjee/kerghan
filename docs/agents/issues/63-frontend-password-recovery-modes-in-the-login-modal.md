# Issue: Frontend: password-recovery modes in the login modal

## Description

Split from #58 (see that issue for the full design rationale and the complete sub-issue list).
Builds on #62 (login modal shell with `password` / `register` modes + the `LoginModalEvents`
bus), now merged.

This folds the two password-recovery flows into the login modal and removes the standalone
`#/recover` page, keeping `#/recover-password?token=…` (the emailed reset link, which must work
on a device with no session) as a thin landing that opens the modal.

Backend is unchanged: `POST /auth/recover.json` and `POST /auth/reset-password.json` already
exist, wrapped by `client/AccountsClient.js` (`recover`, `resetPassword`, neither touching
`AuthSession`). The enumeration-safe "always report sent" behaviour currently lives in
`RecoverController.handleSubmit` (a `try { client.recover(email) } finally { setSent(true) }`),
not in `AccountsClient`; the modal's `recover` handler must reproduce that same
never-branch-on-outcome contract.

## Problem

- `Recover.jsx` and `ResetPassword.jsx` are separate pages, each with their own `controllers/` +
  `helpers/` + specs, inconsistent with the modal now used for login/register (#62).
- `#/recover-password?token=…` must remain reachable from an email on an unauthenticated device.
- The header's Recover control is still a plain `<Nav.Link href="#/recover">`, not wired to the
  modal the way Login/Register already are.

## Expected Behavior

- The modal gains a **Recover password** mode, shown as a third selectable tab alongside
  Password and Register. One email field → `AccountsClient.recover` → a neutral "if that address
  has an account, a reset link is on its way" panel, shown regardless of outcome (mirroring the
  `try/finally` contract in the old `RecoverController`). The modal stays open on the panel; the
  user dismisses it with the modal's own close control.
- The modal gains a **Set new password** mode that is *not* a selectable tab — it is reachable
  only via `LoginModalEvents.open('resetPassword', { token })`. New password + confirmation
  fields, token supplied programmatically → `AccountsClient.resetPassword` → a "password updated"
  panel. No auto-login. The success panel includes a link that switches the modal to Password
  login mode. Client-side validation reuses `ResetPasswordController.validate()`.
- `#/recover-password?token=…` renders a minimal `ResetPasswordLanding` component that, on
  mount, reads `token` from the hash query string, calls
  `LoginModalEvents.open('resetPassword', { token })`, and sets `window.location.hash = '/'`.
  `typeof window` guarded for SSR/spec safety.
- The header's Recover control opens the modal in Recover mode, going through the same
  `onOpenLogin(mode)` path Login/Register use (which already `preventDefault`s).
- The standalone `Recover.jsx` page (helper, controller, specs) is deleted. `ResetPassword.jsx`
  is renamed to `ResetPasswordLanding.jsx` and reduced to the landing described above;
  `ResetPasswordHelper.jsx` is deleted (a redirect-only landing needs no view helper);
  `ResetPasswordController.js` is kept for its `validate()`.
- Stale `#/recover` bookmarks fall back to home (the same treatment #62 gave `#/login` and
  `#/register`) — the `recover` route and its `PAGES` entry are removed outright, not repointed
  at a redirect.

## Solution

### Scope

`frontend/` only. Owning agent: **frontend**.

The `recover` and `resetPassword` modes across `LoginModalController` /
`LoginModalFormsHelper` / `LoginModalHelper` / `useLoginModal` / `LoginModal.jsx`, the new
`ResetPasswordLanding.jsx` route component, route + `PAGES` removals, header wiring for
Recover, deletion of the Recover page trio, and slimming of the ResetPassword page. Mirrored
Jasmine specs (Jasmine + c8).

Explicitly **out of scope**:

- Any backend change.
- Device-authorization mode — #58 sub-issue 6.
- The Authorizations page — #58 sub-issue 7.

### What needs to be done

**Token plumbing (new — `open('resetPassword', { token })` is not wired end-to-end today).**
`LoginModalEvents.open(mode, detail)` already merges arbitrary `detail` into the
`login-modal:toggle` event, but `hooks/useLoginModal.js` currently forwards only `detail.mode`
to `controller.switchMode(mode)` and drops every other key. Add token flow through:

- `hooks/useLoginModal.js` — forward the token (or the whole remaining `detail`) from the
  event, not just `detail.mode`.
- `controllers/LoginModalController.js` — accept and hold the reset token (constructor / a
  setter grows accordingly); `switchMode` must not silently drop it.
- `LoginModal.jsx` — thread the extra state/setter into the memoized controller.

**Modes wiring.**

- `controllers/LoginModalController.js` — extend `MODES` with `recover` / `resetPassword`;
  replace the two-branch `handleSubmit` if/else with a dispatch map keyed by mode (keeps it
  under the complexity-10 / nesting-4 lint limits with four modes). Add `#submitRecover`
  (calls `AccountsClient.recover`, always shows the neutral panel — reproduce the old
  `try/finally` so a rejected request still shows "sent") and `#submitResetPassword`
  (validates via a shared `new ResetPasswordController(noop, noop, noop)` instance — the same
  pattern as the existing `registerValidator` — takes the token from controller state, calls
  `AccountsClient.resetPassword`, shows the success panel, does **not** call the shared
  `#handleSuccess` / `LoginModalEvents.close()` / redirect).
- Neither `recover` nor `resetPassword` should reach `#handleSuccess` (which force-closes and
  redirects home) — add a distinct result-panel state (e.g. `resultPanel`) so the modal stays
  open showing the panel.
- `helpers/LoginModalFormsHelper.jsx` — this file owns the mode tables. Add `recover` to
  `MODE_TABS` (third tab); add `recover` / `resetPassword` to `FIELDS_BY_MODE` (recover:
  email; resetPassword: password + passwordConfirmation) and `SUBMIT_LABELS`; leave
  `resetPassword` out of `MODE_TABS` (programmatic-only). Rework the hard-coded
  `state.mode === 'register' ? 'register' : 'password'` fallback in `#renderForm` so the new
  modes render their own forms rather than collapsing to `password`. Add the neutral-recover
  and password-updated result panels (porting the copy from the `RecoverHelper` /
  `ResetPasswordHelper` confirmations being deleted); the password-updated panel gets the
  "back to log in" link that calls `switchMode('password')`.
- `helpers/LoginModalHelper.jsx` — add `recover` / `resetPassword` entries to `TITLES`.

**Landing + routing.**

- New `components/resources/accounts/pages/ResetPasswordLanding.jsx` — on mount: parse `token`
  from `window.location.hash` query string *inside this component* (move the existing
  module-private `getTokenFromHash` out of `ResetPassword.jsx`; it is **not** in the
  controller today), `LoginModalEvents.open('resetPassword', { token })`, then
  `window.location.hash = '/'`. `typeof window` guard.
- `utils/routing/HashRouteResolver.js` — remove `['/recover','recover']`; keep
  `['/recover-password','reset-password']`.
- `components/helpers/AppHelper.jsx` — `PAGES['reset-password']` → `<ResetPasswordLanding />`;
  remove the `recover` entry entirely (no `ModalRedirect` fallback — `ModalRedirect` carries
  no `detail` and cannot pass a token anyway).

**Header.**

- `components/common/header/helpers/HeaderHelper.jsx` — replace the plain
  `<Nav.Link href="#/recover">Recover</Nav.Link>` with the same
  `#renderLoginLink('recover', 'Recover', onOpenLogin)` path Login/Register already use.

**Deletions / rename.**

- Delete `components/resources/accounts/pages/Recover.jsx`,
  `helpers/RecoverHelper.jsx`, `controllers/RecoverController.js` and their specs.
- `git mv` `pages/ResetPassword.jsx` → `pages/ResetPasswordLanding.jsx`; delete
  `helpers/ResetPasswordHelper.jsx` and its spec; keep
  `controllers/ResetPasswordController.js` (`validate()` is reused by the modal — note it is
  an instance method, hence the shared-noop instance pattern above).

**Specs (Jasmine + c8).**

- `LoginModalControllerSpec.js` — extend the `client` spy (currently `['login', 'register']`)
  with `recover` / `resetPassword`; cover both new handlers, including the recover
  "still shows panel on rejection" case and a reset validation failure.
- `useLoginModalSpec.js` — token forwarded from the event detail.
- `LoginModalFormsHelperSpec.js` / `LoginModalHelperSpec.js` — new tab, forms, result panels,
  titles.
- New `ResetPasswordLandingSpec.js` — reads token, opens the modal with `{ token }`,
  redirects to `#/`.
- `HeaderHelperSpec.js` — Recover link now calls `onOpenLogin('recover')`.
- `HashRouteResolverSpec.js` — `#/recover` no longer resolves (falls back to home).
- `AppHelperSpec.js` — `reset-password` → landing; no `recover` key.
- Delete the `Recover*` and `ResetPasswordHelper` specs.

### Acceptance criteria

- [ ] The modal shows a third **Recover** tab that calls `AccountsClient.recover` and always
      shows the same neutral panel — including when the request rejects — with the modal left
      open.
- [ ] A **Set new password** mode, entered only via
      `LoginModalEvents.open('resetPassword', { token })`, validates via
      `ResetPasswordController.validate()`, calls `AccountsClient.resetPassword`, shows a
      success panel with a "back to log in" link, and never auto-logs-in.
- [ ] `#/recover-password?token=…` opens the modal in Set-new-password mode with that token
      and redirects to `#/`.
- [ ] The header's Recover control opens the modal in Recover mode via the shared
      `onOpenLogin` path.
- [ ] `#/recover` no longer resolves (falls back to home); the `recover` route and `PAGES`
      entry are gone.
- [ ] `Recover.jsx` + helper + controller + specs are deleted; `ResetPassword.jsx` is renamed
      to `ResetPasswordLanding.jsx`; `ResetPasswordHelper.jsx` is deleted;
      `ResetPasswordController.validate()` still has coverage.
- [ ] Frontend lint and all Jasmine specs pass.

## Benefits

- Brings all four account-auth flows (login, register, recover, reset) behind one consistent
  modal.
- Keeps the emailed-reset-link path working on an unauthenticated device with a minimal
  landing.
- Removes another standalone page trio and its duplicated markup.
