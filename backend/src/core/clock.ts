import { Injectable } from '@nestjs/common';

/**
 * The injected time source: every time rule reads it, never `Date.now()` directly,
 * so tests drive time with a fake. Used as its own DI token.
 */
export abstract class Clock {
  /**
   * The current instant.
   * @returns {Date} Now.
   */
  abstract now(): Date;
}

/**
 * The production `Clock`, reading the system time.
 */
@Injectable()
export class SystemClock extends Clock {
  /**
   * The current system time.
   * @returns {Date} Now.
   */
  now(): Date {
    return new Date();
  }
}
