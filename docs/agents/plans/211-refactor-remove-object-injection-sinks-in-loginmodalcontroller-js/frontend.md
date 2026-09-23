# Frontend Plan: Refactor: Remove object-injection sinks in LoginModalController.js

Main plan: [plan.md](plan.md)

## Overview
Replace the two bracket-access lookups in `LoginModalController` (`handlers[mode]` at `:118`, `DEVICE_REJECTION_PANELS[status]` at `:256`) with `Map#get`, keeping every existing fallback and behavior. Then add a spec for the unknown-mode fallback.

## Context
Codacy reports both lines as High `security/detect-object-injection` findings. The frontend ESLint config stubs this rule, and Codacy ignores inline disables, so the code itself has to change. The issue requires identical behavior: an unknown mode falls back to password submit, and each rejection status maps to the same panel it does today. For a status with no entry, `setResultPanel` receives `undefined`, as it does now.

## Implementation Steps

### Step 1 — Switch both lookups to `Map`
In `LoginModalController.js`:

- Turn the module-level `DEVICE_REJECTION_PANELS` into a `Map`:
  ```js
  const DEVICE_REJECTION_PANELS = new Map([
    ['denied', 'device:denied'],
    ['expired', 'device:expired'],
    ['logged', 'device:logged'],
    ['notFound', 'device:notFound'],
  ]);
  ```
  In `#handleDeviceRejection`, call `this.setResultPanel(DEVICE_REJECTION_PANELS.get(status));`. Do not add a `?? null` fallback. An unknown status must still pass `undefined`.
- In `handleSubmit`, build `handlers` as a `Map` keyed by the `MODES` values. It stays local because its arrows close over `fields`/`resetToken`. Dispatch with:
  ```js
  return (handlers.get(mode) ?? (() => this.#submitPassword(fields)))();
  ```
- Leave the JSDoc as is, except wording that describes the constant as an object. Its comment still says "Maps a … rejection status to its result-panel value", which fits a `Map` too.
- Do not touch `MODES` or `INITIAL_FIELDS`. Keep cyclomatic complexity at or under 10; this change adds no branches.

### Step 2 — Add the unknown-mode spec
In `LoginModalControllerSpec.js`, add a `describe('#handleSubmit unknown mode', ...)` block (or an `it` inside the password-mode block) that:
- calls `build().handleSubmit('bogus', passwordFields)` after `client.login.and.resolveTo({ user: { isAdmin: false } })`;
- expects `client.login` to have been called with `passwordFields`, and the shared success path to have run (`AuthEvents.emit` called once with `(true, false)`, `LoginModalEvents.close` called once).

Leave every existing case unchanged.

## Files to Change
- `frontend/assets/js/components/common/loginModal/controllers/LoginModalController.js`: switch `DEVICE_REJECTION_PANELS` and `handlers` to `Map` + `.get()`.
- `frontend/specs/assets/js/components/common/loginModal/controllers/LoginModalControllerSpec.js`: add the unknown-mode fallback case.

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: frontend lint via `yarn_project`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: frontend tests/coverage via `yarn_project`). Coverage must not drop.

## Notes
- **Unknown rejection status spec: intentionally skipped.** The issue asks for an unknown-rejection-status case, but `#handleDeviceRejection` is private and only reachable through `AuthorizationRequestPoller`. The poller only ever emits `denied`/`expired`/`logged`/`notFound`, and it keeps its `onRejected` in a private field, and the controller builds it with `new` inside the module. Reaching that path would need a production change, such as an injectable poller factory, which is out of scope for a no-behavior-change refactor. `Map#get` on a missing key adds no branch, so coverage is unaffected. Behavior for an unknown status stays identical (`setResultPanel(undefined)` plus stopping the poller).
- Do not run tooling on the host. Use docker-compose only.
