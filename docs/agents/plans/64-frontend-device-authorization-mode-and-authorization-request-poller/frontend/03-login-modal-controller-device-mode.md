# LoginModalController device mode + poller lifecycle

Add the `device` mode to `LoginModalController`.

- `MODES.device = 'device'`.
- Constructor: add `setDeviceExpiresAt` to the positional setter list, before `client` (which
  keeps its `= AccountsClient` default). Reuse the existing `setResultPanel` for the device
  panel value — no other new setter.
- `handleSubmit` dispatch table: add `[MODES.device]: () => this.#submitDevice(fields)`.
- `#submitDevice({ username })`:
  1. `this.setSubmitError(null)`.
  2. `const { uuid, pollToken, expiresAt } = await this.client.createAuthorizationRequest(username)`
     — on a thrown error, `this.setSubmitError(error.message)` and return (stay on the form).
  3. `this.setDeviceExpiresAt(expiresAt)`; `this.setResultPanel('device:waiting')`.
  4. `this.poller = new AuthorizationRequestPoller({ uuid, pollToken, expiresAt,
     onApproved: (result) => this.#handleSuccess(result),
     onRejected: (status) => this.#handleDeviceRejection(status) })`; `this.poller.start()`.
- `#handleDeviceRejection(status)` — map `status` → panel: `denied → 'device:denied'`,
  `expired → 'device:expired'`, `logged → 'device:logged'`, `notFound → 'device:notFound'`;
  `this.setResultPanel(panel)`; `this.stopPoller()`.
- `stopPoller()` — `this.poller?.stop(); this.poller = null;` Null-safe; safe to call when no
  poller exists.
- `switchMode(mode)` — call `this.stopPoller()` and `this.setDeviceExpiresAt(null)` at the top,
  then keep the existing field / error / panel resets, so leaving `device` (or any mode change)
  always tears the poller down.

`#handleSuccess` is reused unchanged: `approved` carries `{ user: { isAdmin }, refreshToken }`,
`AuthSession` was already set inside `pollAuthorizationRequest`, so emit / close / redirect is
identical to password login. `onApproved` must be the closure over `#handleSuccess` created here
(the method is private).

Extend `LoginModalControllerSpec.js`: inject a fake `client` with `createAuthorizationRequest` /
`pollAuthorizationRequest` spies; stub the poller (e.g.
`spyOn(AuthorizationRequestPoller.prototype, 'start')` and capture the constructor options).
Cover: `#submitDevice` happy path (create → `device:waiting` panel + `setDeviceExpiresAt` +
poller started), create failure (submit error, no poller), `onApproved` → shared success handler
(`AuthEvents.emit`, `LoginModalEvents.close`, hash `#/`), `#handleDeviceRejection` for each
status → matching panel + `stopPoller`, and `switchMode` calling `stopPoller` +
`setDeviceExpiresAt(null)`.

## Files to Change

- `frontend/assets/js/components/common/loginModal/controllers/LoginModalController.js` —
  `device` mode, `#submitDevice`, `#handleDeviceRejection`, `stopPoller`, `switchMode` teardown,
  constructor `setDeviceExpiresAt`.
- `frontend/specs/assets/js/components/common/loginModal/controllers/LoginModalControllerSpec.js`
  — device-mode + lifecycle coverage; update the constructor call for the new positional arg.
