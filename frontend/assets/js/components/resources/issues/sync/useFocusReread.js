import { useEffect } from 'react';
import FocusRereadThrottle from './FocusRereadThrottle.js';

/**
 * Build the effect that re-reads on window focus, at most once every 30 s.
 *
 * @param {Function} reread - Called on a focus that is not throttled.
 * @param {Function} [now] - The clock, in milliseconds.
 * @returns {Function} Effect callback, returning a cleanup function that removes the listener.
 */
export function buildFocusRereadEffect(reread, now) {
  return () => {
    const throttle = new FocusRereadThrottle({ reread, now });

    throttle.attach(window);

    return () => throttle.dispose();
  };
}

/**
 * Re-read on every window focus (throttled to 30 s) while the calling component is mounted.
 *
 * @param {Function} reread - Called on a focus that is not throttled.
 * @returns {void} Nothing.
 */
export default function useFocusReread(reread) {
  useEffect(() => buildFocusRereadEffect(reread)(), [reread]);
}
