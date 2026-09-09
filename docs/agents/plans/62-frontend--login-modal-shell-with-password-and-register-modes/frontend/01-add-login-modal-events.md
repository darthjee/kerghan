# Add LoginModalEvents bus

Create `client/LoginModalEvents.js` as a byte-for-byte structural mirror of the existing
`client/AuthEvents.js`, but for a `login-modal:toggle` `CustomEvent` on `window` instead of
`auth:changed`. Expose:

- `open(mode, detail)` — dispatches the event with `{ mode, ...detail }` (or whatever shape
  `AuthEvents.emit` uses for its detail payload, generalized to carry a `mode` string plus
  optional extra detail).
- `close()` — dispatches the event with a payload that signals "closed" (mirror however
  `AuthEvents` signals its boolean states).
- `subscribe(handler)` / `unsubscribe(handler)` — identical to `AuthEvents`'s implementation,
  just bound to the new event name.

This is the bus that `ApiClient` (step 04) and the header (step 05) will call into, and that
`useLoginModal` (step 03) will subscribe to.

## Files to Change

- `frontend/assets/js/client/LoginModalEvents.js` — new file, mirrors `AuthEvents.js`.
- `frontend/specs/assets/js/client/LoginModalEventsSpec.js` — new spec, mirrors
  `AuthEventsSpec.js`: covers `open`/`close` dispatching the right event/detail and
  `subscribe`/`unsubscribe` adding/removing the listener.
