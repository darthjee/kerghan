import { useEffect } from 'react';
import LoginModalEvents from '../../../../client/LoginModalEvents.js';

/**
 * Build the mount-time login-modal effect: subscribes to the shared `LoginModalEvents` bus so
 * any live `LoginModalEvents.open(...)` / `LoginModalEvents.close()` — from the header,
 * `ApiClient`'s session-expired handling, or any other future caller — drives the modal's
 * open/mode state. On an open request it also asks the controller to switch mode, which resets
 * the form. Returns a cleanup function that unsubscribes and guards against calling the setters
 * once cleanup has already run. Extracted as a plain function, separate from the `useEffect`
 * call itself, so it can be exercised directly in tests without a React renderer — mirroring
 * {@link module:components/common/header/hooks/useAuthEffect}'s `buildAuthEffect`.
 *
 * @param {{switchMode: Function}} controller - Controller exposing a `switchMode(mode)` method.
 * @param {{setOpen: Function}} setters - React state setter for the modal's open flag.
 * @returns {Function} Effect callback, returning a cleanup function.
 */
export function buildLoginModalEffect(controller, { setOpen }) {
  return () => {
    let mounted = true;

    const handleToggle = (event) => {
      if (!mounted) return;

      const detail = event.detail ?? {};
      setOpen(Boolean(detail.open));

      if (detail.open) {
        controller.switchMode(detail.mode);
      }
    };

    LoginModalEvents.subscribe(handleToggle);

    return () => {
      mounted = false;
      LoginModalEvents.unsubscribe(handleToggle);
    };
  };
}

/**
 * Keep the login modal's `open`/`mode` state in sync with the shared `LoginModalEvents` bus.
 * See {@link buildLoginModalEffect} for the effect's behavior.
 *
 * @param {{switchMode: Function}} controller - Controller exposing a `switchMode(mode)` method.
 * @param {{setOpen: Function}} setters - React state setter for the modal's open flag.
 * @returns {void} Nothing.
 */
export default function useLoginModal(controller, setters) {
  useEffect(() => buildLoginModalEffect(controller, setters)(), [controller, setters]);
}
