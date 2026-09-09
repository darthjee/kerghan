# AuthorizationRequestPoller polling primitive

New `frontend/assets/js/utils/polling/AuthorizationRequestPoller.js` — a plain class, no React,
sibling to `utils/routing/`.

Constructor takes an options object:
`{ uuid, pollToken, expiresAt, client = AccountsClient, intervalMs = 5000, onApproved, onRejected, onTick }`.

- `start()` — schedule the first tick via `setTimeout(..., intervalMs)`. SSR/spec guard: when
  `typeof setTimeout === 'undefined'` (or `typeof window === 'undefined'`), no-op — same pattern
  as `AppController`'s `eventTarget` guard and `AuthSession`'s `storage()`. Optionally also arm a
  dedicated `setTimeout` for `Date.parse(expiresAt) - Date.now()` that fires
  `onRejected('expired')` + `stop()`, so expiry is prompt rather than waiting for the next
  interval.
- Each tick:
  1. If `Date.now() >= Date.parse(expiresAt)` → `onRejected('expired')` and stop, with **no**
     network call.
  2. Otherwise `await client.pollAuthorizationRequest(uuid, pollToken)` and dispatch:
     - `status === 'open'` → `onTick?.()` and reschedule.
     - `status === 'approved'` → `onApproved(result)` and stop.
     - `status === 'denied' | 'expired' | 'logged'` → `onRejected(status)` and stop.
     - thrown `ApiError` with `.status === 404` → `onRejected('notFound')` and stop.
     - any other thrown error (network `TypeError`, no `.status`) → swallow, `onTick?.()`,
       reschedule (never give up).
     - falsy / `undefined` resolve → treat as `open`: reschedule.
- `stop()` — `clearTimeout` the pending handle(s) and mark the poller stopped so an in-flight
  tick that resolves afterwards neither reschedules nor fires callbacks.

Export the per-tick body as a standalone named function
`buildPollTick({ uuid, pollToken, expiresAt, client, onApproved, onRejected, onTick, reschedule })`
that `start()` composes, so specs drive one tick directly with plain spies and no timers —
mirroring `buildAuthEffect` / `buildLoginModalEffect`.

New `frontend/specs/assets/js/utils/polling/AuthorizationRequestPollerSpec.js`:
`jasmine.clock().install()` / `.uninstall()` in `beforeEach` / `afterEach` scoped to the class
`describe`; a separate `describe` drives `buildPollTick` directly. Cover: `open` reschedules and
keeps calling; `approved` → `onApproved(result)` + no further ticks; `denied` / `expired` /
`logged` → `onRejected(status)` + stop; a `404` `ApiError` → `onRejected('notFound')` + stop; a
network `TypeError` → keeps polling; `expiresAt` in the past → `onRejected('expired')` with
`client.pollAuthorizationRequest` never called; `stop()` cancels a pending tick and neutralises
an in-flight one.

## Files to Change

- `frontend/assets/js/utils/polling/AuthorizationRequestPoller.js` — new class + `buildPollTick`.
- `frontend/specs/assets/js/utils/polling/AuthorizationRequestPollerSpec.js` — new spec, fake
  timers.
