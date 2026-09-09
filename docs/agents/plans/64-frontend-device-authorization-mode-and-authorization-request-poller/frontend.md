# Frontend Plan: device-authorization mode and authorization-request poller

Main plan: [plan.md](plan.md)

Issue: [64-frontend-device-authorization-mode-and-authorization-request-poller.md](../../issues/64-frontend-device-authorization-mode-and-authorization-request-poller.md)

## Overview

The login modal (shell from #62, recovery modes from #63) gains a fourth mode, **Authorize with
logged device**. Submitting a username calls a new `AccountsClient.createAuthorizationRequest`,
which returns `{ uuid, pollToken, expiresAt }`; the modal then shows a waiting panel with a
countdown while a new `AuthorizationRequestPoller` (plain class, `setTimeout` cadence, extracted
`buildPollTick` for fake-timer specs) calls `AccountsClient.pollAuthorizationRequest` every ~5s.
`approved` reuses the existing `#handleSuccess` path (emit `auth:changed`, close, navigate `#/`);
`denied` / `expired` / `logged` / `404` each stop the poller and show their own panel with a
retry that returns to the empty form. The poller is stopped on modal close, mode switch, and
unmount.

## Context

- No polling primitive exists in the frontend today (`docs/agents/flow.md` — "There is no
  auto-refresh/polling"); `frontend/assets/js/utils/` currently holds only `utils/routing/`.
- The success path for password / register login is `LoginModalController.#handleSuccess(result)`
  — `AuthEvents.emit(true, result.user.isAdmin)` → `LoginModalEvents.close()` → `#redirectHome()`
  (`window.location.hash = '/'`). `#handleSuccess` / `#redirectHome` are private, so the poller's
  `onApproved` must be a closure created inside a controller method.
- `AccountsClient` methods all route through `ApiClient.postJson(path, body)` (never raw `fetch`)
  and use `.json` path suffixes. `login` sets `AuthSession.set(result.refreshToken)` (bare token
  string) before resolving.
- `ApiError` (`client/ApiError.js`) has `.status`; `ApiClient` throws it for any non-ok,
  non-`401` response. A `401` is swallowed by `ApiClient` (refresh-retry → `#sessionExpired()`
  returns `undefined` and opens the password modal).
- The modal body already short-circuits to `LoginModalFormsHelper.#renderResultPanel` whenever
  `state.resultPanel` is set (used today for `recover` / `resetPassword`).

## Steps

- [01 — AccountsClient authorization-request methods](frontend/01-accounts-client-methods.md)
- [02 — AuthorizationRequestPoller polling primitive](frontend/02-authorization-request-poller.md)
- [03 — LoginModalController device mode + poller lifecycle](frontend/03-login-modal-controller-device-mode.md)
- [04 — Login modal helpers: selector, form, panels, countdown](frontend/04-login-modal-helpers-device-mode.md)
- [05 — useLoginModal poller teardown](frontend/05-uselogin-modal-teardown.md)
- [06 — LoginModal.jsx device state wiring](frontend/06-login-modal-wiring.md)

## CI Checks

- `frontend`: `docker-compose run --rm kerghan_tests yarn test` (CI job: `jasmine` — runs `npm run coverage`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks` — runs `npm run lint`)

## Notes

- **Verified backend contract** (from `backend/src/auth/*` and
  `backend/src/auth/tests/authorization-request.controller.e2e-spec.ts`; no backend change in
  this issue):
  - `POST /auth/authorization-requests.json { username }` → `{ uuid, pollToken, expiresAt }`.
    `expiresAt` is an ISO-8601 string over the wire. Identical shape for an unknown username
    (enumeration-safety).
  - `POST /auth/authorization-requests/:uuid/poll.json { pollToken }` →
    `{ status: 'open' }`
    | `{ status: 'approved', user: { id, username, email, isAdmin }, refreshToken }`
    | `{ status: 'denied' }` | `{ status: 'expired' }` | `{ status: 'logged' }`.
  - Unknown `uuid` **or** wrong `pollToken` → HTTP `404` (indistinguishable), reaching the client
    as `ApiError` with `.status === 404`.
  - Only the first (winning) poll after approval returns `approved` *with* credentials; every
    later poll of the same request returns `logged` with **no** `user` / `refreshToken`. Hence
    `approved` and `logged` are distinct branches even though both mean "was approved" — `logged`
    gets its own "already completed on another device" panel.
- Set `AuthSession.set(result.refreshToken)` inside `pollAuthorizationRequest` on `approved`,
  exactly as `login` does, so `#handleSuccess` is reused untouched.
- The poller treats a falsy / `undefined` resolve as `open` (defensive: `ApiClient` swallows a
  stray `401`). These endpoints are `@Public()` so should never 401.
- **First `setTimeout`-based util and first `jasmine.clock()` spec in the frontend.** No global
  clock setup exists to reuse; scope `jasmine.clock().install()` / `.uninstall()` per `describe`.
  `jasmine ^5` supports `.tick()` / `.mockDate()`.
- ESLint enforces max 300 lines / max complexity 10 per file (`eslint-plugin-complexity`).
  `LoginModalFormsHelper.jsx` is already ~188 lines and gains several device panels — factor a
  `#renderDevicePanel` sub-method to stay under the caps.
- `LoginModalController`'s constructor is positional; adding `setDeviceExpiresAt` shifts `client`
  to the last positional arg — update both call sites (`LoginModal.jsx` and
  `LoginModalControllerSpec.js`).
