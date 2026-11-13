import { Clock } from '../../clock.js';

/**
 * A test `Clock` driven by hand: `set(date)` and `advance(ms)`.
 */
export class FakeClock extends Clock {
  #current: Date;

  constructor(start: Date = new Date('2026-01-01T00:00:00Z')) {
    super();
    this.#current = new Date(start.getTime());
  }

  now(): Date {
    return new Date(this.#current.getTime());
  }

  set(date: Date): void {
    this.#current = new Date(date.getTime());
  }

  advance(ms: number): void {
    this.#current = new Date(this.#current.getTime() + ms);
  }
}
