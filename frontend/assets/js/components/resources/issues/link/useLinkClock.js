import { useEffect, useState } from 'react';
import LinkClockTicker from './LinkClockTicker.js';

/**
 * Build the effect that ticks the link panel's clock every 30 s.
 *
 * @param {Function} setNow - Receives the current epoch milliseconds on every tick.
 * @returns {Function} Effect callback, returning a cleanup function that stops the ticker.
 */
export function buildLinkClockEffect(setNow) {
  return () => {
    const ticker = new LinkClockTicker(setNow);

    ticker.start();

    return () => ticker.stop();
  };
}

/**
 * The current time, refreshed every 30 s while the caller is mounted, so relative times stay
 * current.
 *
 * @returns {number} The current epoch milliseconds.
 */
export default function useLinkClock() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => buildLinkClockEffect(setNow)(), []);

  return now;
}
