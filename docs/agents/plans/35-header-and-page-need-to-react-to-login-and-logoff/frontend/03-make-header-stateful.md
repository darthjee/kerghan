# Make Header stateful via a useAuthEffect hook

`Header.jsx` currently has no state at all — it reads `AuthSession.isLoggedIn()` inline
at render time (`Header.jsx:25`) and only reflects changes because every login/logout
flow happens to redirect, forcing a full re-render. Replace that with real state driven
by `AuthEvents`.

New hook, `frontend/assets/js/components/common/header/hooks/useAuthEffect.js` — first
`hooks/` folder in this codebase:

```js
import { useEffect } from 'react';
import AuthEvents from '../../../../client/AuthEvents.js';

export default function useAuthEffect(controller, setLoggedIn) {
  useEffect(() => {
    let mounted = true;

    const handleAuthChanged = (event) => {
      if (mounted) setLoggedIn(Boolean(event.detail?.loggedIn));
    };

    AuthEvents.subscribe(handleAuthChanged);
    controller.checkStatus();

    return () => {
      mounted = false;
      AuthEvents.unsubscribe(handleAuthChanged);
    };
  }, [controller, setLoggedIn]);
}
```

Subscribing *before* calling `checkStatus()` means the mount-time confirmation's own
`AuthEvents.emit(...)` (added in step 02) is what ultimately updates state — one code
path for "mount-time confirmation" and "live change" from anywhere else. The `mounted`
flag guards against `setLoggedIn` firing after the effect's own cleanup has run (e.g. a
fast unmount before `checkStatus()` resolves).

`Header.jsx` itself:

```js
import { useMemo, useState } from 'react';
import HeaderHelper from './helpers/HeaderHelper.jsx';
import HeaderController from './controllers/HeaderController.js';
import useAuthEffect from './hooks/useAuthEffect.js';
import AuthSession from '../../../client/AuthSession.js';

export default function Header({ children }) {
  const controller = useMemo(() => new HeaderController(), []);
  const [loggedIn, setLoggedIn] = useState(AuthSession.isLoggedIn());

  useAuthEffect(controller, setLoggedIn);

  const handleLogout = (event) => {
    event.preventDefault();
    return controller.handleLogout();
  };

  return (
    <>
      {HeaderHelper.render(loggedIn, handleLogout)}
      {children}
    </>
  );
}
```

`AuthSession.isLoggedIn()` is still used, but only once, as the optimistic initial state
before the mount-time check confirms/corrects it — not read on every render as before.

## Files to Change

- `frontend/assets/js/components/common/header/hooks/useAuthEffect.js` — new file, as
  above.
- `frontend/specs/assets/js/components/common/header/hooks/useAuthEffectSpec.js` — new
  spec (mirrors the new `hooks/` folder under `specs/`): subscribes on mount, calls
  `controller.checkStatus()`, updates state when `AuthEvents.emit(...)` fires,
  unsubscribes on unmount, and does not call `setLoggedIn` if `checkStatus()` resolves
  after unmount.
- `frontend/assets/js/components/common/header/Header.jsx` — becomes stateful, as above.
- `frontend/specs/assets/js/components/common/header/HeaderSpec.js` — update for the new
  state-driven render (was previously asserting a direct `AuthSession.isLoggedIn()` read
  per render).
