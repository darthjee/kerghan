import type { Clock } from '../core/clock.js';

/**
 * The injected clock's current instant in whole seconds: `datetime` columns keep no fraction (MySQL
 * would round a fractional value), so a response built from the in-memory value matches the row.
 * @param {Clock} clock - The time source.
 * @returns {Date} The instant, truncated to the second.
 */
export function stampOf(clock: Clock): Date {
  return new Date(Math.floor(clock.now().getTime() / 1000) * 1000);
}

/**
 * A date truncated to whole seconds: GitHub's timestamps carry none, and `datetime` columns keep no
 * fraction, so a value read back equals the one compared.
 * @param {Date} date - The instant.
 * @returns {Date} The instant, truncated to the second.
 */
export function wholeSeconds(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 1000) * 1000);
}
