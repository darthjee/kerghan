# Issue: Refactor: Remove object-injection sinks in LoginModalController.js

## Description
`LoginModalController` dispatches submit handlers and device-rejection panels with bracket access keyed by runtime values (`mode` and the poller's rejection `status`).

## Problem
`security/detect-object-injection` (High) in `frontend/assets/js/components/common/loginModal/controllers/LoginModalController.js`:

- `:118` — `handlers[mode] ?? (() => this.#submitPassword(fields))`
- `:256` — `DEVICE_REJECTION_PANELS[status]`

The frontend ESLint config stubs this rule, so only Codacy reports it, and Codacy ignores inline disables.

## Expected Behavior
- Submitting in every mode (`password`, `register`, `recover`, `resetPassword`, `device`) behaves exactly as today.
- An unknown or missing mode still falls back to the password submit.
- Every device-rejection status (`denied`, `expired`, `logged`, `notFound`) shows the same panel as today and stops the poller.
- An unknown rejection status (not reachable from `AuthorizationRequestPoller` today) keeps today's behavior: `setResultPanel` receives `undefined` and the poller is stopped.

## Solution
- Turn `DEVICE_REJECTION_PANELS` into a module-level `Map` and read it with `.get(status)`.
- Build `handlers` in `handleSubmit` as a `Map` (it still closes over `fields`/`resetToken`) and dispatch with `handlers.get(mode) ?? (() => this.#submitPassword(fields))`, keeping the password fallback.
- Keep cyclomatic complexity at or under 10; no other behavioral or structural changes.
- Existing `LoginModalControllerSpec` cases stay unchanged. Add:
  - a case submitting with an unknown mode that asserts the password path runs (login called, shared success path);
  - a case where the poller rejects with an unknown status that asserts `setResultPanel` is called with `undefined` and the poller is stopped.

## Benefits
Removes two High Codacy findings and makes the lookup fallbacks explicit.

## Verification

- `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` pass, with coverage not reduced.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
