# Add the AuthEvents module

New static class wrapping a single `window` `CustomEvent`, following the same
static-methods-only convention as `AuthSession` (`frontend/assets/js/client/AuthSession.js`).
No dependency on React or any other module — a plain event-bus utility any component can
import independently.

```js
const AUTH_CHANGED_EVENT = 'auth:changed';

export default class AuthEvents {
  static emit(loggedIn) {
    window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: { loggedIn } }));
  }
  static subscribe(handler) { window.addEventListener(AUTH_CHANGED_EVENT, handler); }
  static unsubscribe(handler) { window.removeEventListener(AUTH_CHANGED_EVENT, handler); }
}
```

## Files to Change

- `frontend/assets/js/client/AuthEvents.js` — new file, as above.
- `frontend/specs/assets/js/client/AuthEventsSpec.js` — new spec: `emit` dispatches a
  `window` event of type `auth:changed` carrying `{ detail: { loggedIn } }` for both
  `true`/`false`; `subscribe`/`unsubscribe` add/remove a `window` listener (assert via a
  spy passed to `subscribe`, then confirm `unsubscribe` stops it from firing on a
  subsequent `emit`).
