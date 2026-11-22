import { useEffect, useState } from 'react';
import RateLimitCountdownController from '../RateLimitCountdownController.js';

const IDLE = { active: false, secondsLeft: 0, label: null };

/**
 * Count down a rate limit's `retryAfterSeconds`.
 *
 * @description Restarts whenever `retryAfterSeconds` changes (a new error) and clears its timer
 * on unmount. It only reports the state; it never resubmits.
 * @param {(number|undefined)} retryAfterSeconds - The seconds to wait, from the error; a missing
 *   or invalid value is not active.
 * @returns {{active: boolean, secondsLeft: number, label: (string|null)}} Whether the wait is
 *   on, the seconds left, and the label (`Try again in N s`).
 */
export default function useRateLimitCountdown(retryAfterSeconds) {
  const [state, setState] = useState(IDLE);

  useEffect(() => {
    const controller = new RateLimitCountdownController(retryAfterSeconds, setState);

    setState(controller.state);

    return () => controller.dispose();
  }, [retryAfterSeconds]);

  return state;
}
