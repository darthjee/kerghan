# Issue: Frontend: device-authorization mode and authorization-request poller

## Description

Split from #58 (see that issue for the full design rationale and the complete sub-issue list).
Depends on #58 sub-issue 2 (create/poll endpoints — merged as #60/#61) and #58 sub-issue 4
(login modal shell + `LoginModalEvents` bus — merged as #62, with recovery modes in #63).

This is the requesting-device UI: the modal's **Authorize with logged device** mode plus the
client-side poll loop that drives it. The user enters only a username, a request is created, and
the modal polls until another device approves it — then the same shared success handler that
password login uses runs.

There is no polling primitive in the frontend today (`docs/agents/flow.md` — "There is no
auto-refresh/polling"), so the poller is net-new. Model its testability on the
`buildAuthEffect` / `buildEffect` "extract the effect body as a plain function" pattern
(`components/common/header/hooks/useAuthEffect.js`, `components/AppController.js`).

## Problem

- The modal has no way to start a device-authorization request or react to its outcome. The mode
  selector today has three buttons (`Password` / `Register` / `Recover`) and no device concept.
- A poll loop needs `setTimeout` (not `setInterval`, so a slow response can't stack), retries on
  transient errors, and deterministic teardown on modal close / mode switch / unmount / resolution
  — and it needs to be unit-testable with fake timers, without a renderer.
- The backend distinguishes the *winning* poll (`approved`, carries credentials) from every later
  poll of the same request (`logged`, no credentials); the modal must treat these as different
  outcomes.

## Expected Behavior

- The modal's mode selector gains a fourth button, **Authorize with logged device**, next to
  `Password` / `Register` / `Recover`. Its form has a single username field.
- Submit → `AccountsClient.createAuthorizationRequest(username)` → `{ uuid, pollToken, expiresAt }`
  → instantiate and `start()` the poller; the modal switches to a waiting state showing a spinner
  and a live countdown to `expiresAt`.
- The poller calls `AccountsClient.pollAuthorizationRequest(uuid, pollToken)` every ~5s:
  - `open` → keep waiting.
  - `approved` → the response carries `{ user, refreshToken }`; `AuthSession` is set (inside the
    client method); the shared success handler runs — `AuthEvents.emit(true, user.isAdmin)`, close
    the modal (`LoginModalEvents.close()`), navigate to `#/`.
  - `logged` → the request was already completed on another device and no credentials come back;
    stop, show a distinct "this login was already completed on another device" message, offer
    retry.
  - `denied` / `expired` → stop, show the matching message, offer retry.
  - an `ApiError` with status `404` (unknown `uuid` or wrong `pollToken` — indistinguishable) →
    stop, "request not found", offer retry.
  - any other thrown error (network `TypeError`, no `.status`) → keep retrying, do not give up.
- The poller also stops itself once `expiresAt` passes, without waiting for the next poll
  response, and shows the same expired state.
- **Retry** from any terminal state clears the panel and returns to the empty username form; the
  user resubmits to create a fresh request.
- Closing the modal, switching modes, or unmounting stops the poller (no leaked timers).

## Solution

### Scope

`AuthorizationRequestPoller`, the two new `AccountsClient` methods, the modal's `device` mode
(form + waiting/countdown + denied/expired/logged/not-found states) and its poller lifecycle.
Jasmine specs with fake timers.

Explicitly **out of scope**:

- The approver-side page — #58 sub-issue 7.
- Any backend change.
- Rate-limiting UX copy nuances beyond a basic message — #58 sub-issue 8 owns the backend limits.

### What needs to be done

- New `frontend/assets/js/utils/polling/AuthorizationRequestPoller.js` — plain class, no React
  (sibling to `utils/routing/`). Constructor `{ uuid, pollToken, expiresAt, client = AccountsClient,
  intervalMs = 5000, onApproved, onRejected, onTick }`. `start()` schedules the next tick via
  `setTimeout`; each tick calls `client.pollAuthorizationRequest(uuid, pollToken)` and dispatches
  per "Expected Behavior"; if `expiresAt` has passed it resolves as `expired` without another
  network call. `stop()` clears the pending timeout. Guard `typeof setTimeout` / `typeof window`
  the way `AppController` guards `eventTarget`, so specs run under Node. Export the per-tick body
  as a standalone named function (`buildPollTick`) taking its collaborators as arguments, so specs
  drive it directly with no renderer and no real timers.
- `frontend/assets/js/client/AccountsClient.js` — add (both via `ApiClient.postJson`, like every
  other method; paths carry the `.json` suffix):
  - `createAuthorizationRequest(username)` →
    `POST /auth/authorization-requests.json { username }` → `{ uuid, pollToken, expiresAt }`
    (`expiresAt` is an ISO string). Does not touch `AuthSession`.
  - `pollAuthorizationRequest(uuid, pollToken)` →
    `POST /auth/authorization-requests/${uuid}/poll.json { pollToken }` →
    `{ status, user?, refreshToken? }`; when `status === 'approved'`, call
    `AuthSession.set(result.refreshToken)` (bare token string, like `login`) before resolving, so
    the modal's success path is identical to `login`.
- `components/common/loginModal/` — add the `device` mode:
  - `controllers/LoginModalController.js` — add `MODES.device`, a `#submitDevice(fields)` handler
    in the `handleSubmit` dispatch table that calls `createAuthorizationRequest` then instantiates
    `AuthorizationRequestPoller` with `onApproved` → a closure over the existing private
    `#handleSuccess(result)` (emit / close / redirect), `onRejected(status)` → per-status message
    + return to form. Hold the poller instance on the controller and expose `stopPoller()`;
    `switchMode` must call it.
  - `helpers/LoginModalHelper.jsx` / `helpers/LoginModalFormsHelper.jsx` — add the `device` entry
    to `MODE_TABS`, and `device` keys to `FIELDS_BY_MODE`, `SUBMIT_LABELS`, `TITLES`. New render
    branch for the waiting state (spinner + countdown) and the terminal states
    (denied / expired / logged / not-found), each with a retry control that returns to the empty
    `device` form.
  - `hooks/useLoginModal.js` — extend `buildLoginModalEffect` so the close event
    (`detail.open === false`) and the effect cleanup both call `controller.stopPoller()`,
    mirroring the existing `mounted`-flag teardown.
- Specs (Jasmine ^5 + c8), introducing `jasmine.clock()` (scoped per-`describe`, installed and
  uninstalled in `beforeEach` / `afterEach`):
  - `frontend/specs/assets/js/utils/polling/AuthorizationRequestPollerSpec.js` — drives
    `buildPollTick` directly and the class with fake timers: `open` keeps polling; `approved` →
    `onApproved` + stop; `logged` / `denied` / `expired` / `404` → `onRejected(status)` + stop;
    network error → retries; `expiresAt` in the past → `expired` without a poll call; `stop()`
    clears the timer.
  - `AccountsClientSpec.js` — extended for the two methods (exact path + body assertions;
    `AuthSession.get()` set only on `approved`).
  - `LoginModalControllerSpec.js` — extended for the `device` mode submit, `onApproved` → shared
    success handler, `onRejected` per-status, and `stopPoller()` on close / mode switch.
  - `useLoginModalSpec.js` — extended for `stopPoller()` on the close event and on cleanup.

### Acceptance criteria

- [ ] The mode selector shows a fourth **Authorize with logged device** button; its form takes a
      username, calls `createAuthorizationRequest`, and shows a waiting state with a countdown to
      `expiresAt`.
- [ ] The poller calls `pollAuthorizationRequest` on a `setTimeout` cadence; `open` keeps it
      going, a transient network error keeps it going, and `approved` / `logged` / `denied` /
      `expired` / `404` each stop it.
- [ ] On `approved`, `AuthSession` holds the returned refresh token and the same shared success
      handler as password login runs (`AuthEvents.emit(true, isAdmin)`, close modal, navigate to
      `#/`).
- [ ] `logged` shows a distinct "already completed on another device" message — not the
      denied/expired copy.
- [ ] `denied` / `expired` / not-found each show their own message; every terminal state offers a
      retry that returns to the empty username form.
- [ ] The poller stops itself when `expiresAt` passes, without waiting for a poll response.
- [ ] Closing the modal, switching modes, or unmounting stops the poller (no leaked timers).
- [ ] `AuthorizationRequestPoller`'s tick body is exercised by specs with fake timers, no
      renderer.
- [ ] New/updated Jasmine specs pass; frontend lint and tests pass.

## Benefits

- Delivers the password-less login experience end to end for the driving mobile use case.
- Adds a small, reusable, well-tested polling primitive the codebase currently lacks.
- Converges on the existing shared success handler, so a device login is indistinguishable from a
  password login to the rest of the app.
