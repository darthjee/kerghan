import { useEffect } from 'react';

/**
 * Build the window-focus re-check effect: subscribes to the window `focus` event and calls
 * `controller.checkAgain()` on each one, so an approval granted while the tab was in the
 * background is picked up when the user comes back. Starts no timer. Returns a cleanup function
 * that unsubscribes. Extracted as a plain function so it can be exercised directly in tests
 * without a React renderer.
 *
 * @param {{checkAgain: Function}} controller - Controller exposing a `checkAgain()` method.
 * @returns {Function} Effect callback, returning a cleanup function.
 */
export function buildFocusEffect(controller) {
  return () => {
    const handleFocus = () => {
      controller.checkAgain();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  };
}

/**
 * Re-check the account status on every window focus while the calling component is mounted. See
 * {@link buildFocusEffect} for the effect's behavior.
 *
 * @param {{checkAgain: Function}} controller - Controller exposing a `checkAgain()` method.
 * @returns {void} Nothing.
 */
export default function useWindowFocusRecheck(controller) {
  useEffect(() => buildFocusEffect(controller)(), [controller]);
}
