import { Injectable } from '@nestjs/common';
import { Clock } from './clock.js';

/** An opaque handle of a scheduled callback, handed back to `Scheduler#cancel`. */
export type SchedulerHandle = object;

/**
 * The injected timer source: time-dependent code (the rate-limit timers) schedules a callback at an
 * instant instead of calling `setTimeout` directly, so tests drive time with a fake. Used as its
 * own DI token.
 */
export abstract class Scheduler {
  /**
   * @param {Date} at - The instant to fire at (an instant already past fires as soon as possible).
   * @param {() => void} fn - The callback, run once.
   * @returns {SchedulerHandle} The handle, for `cancel`.
   */
  abstract schedule(at: Date, fn: () => void): SchedulerHandle;

  /**
   * Cancels a scheduled callback that has not fired yet; a no-op for one that already fired.
   * @param {SchedulerHandle} handle - The handle `schedule` returned.
   * @returns {void}
   */
  abstract cancel(handle: SchedulerHandle): void;
}

/** The longest delay `setTimeout` accepts (a larger one fires at once). */
const MAX_TIMER_MS = 2 ** 31 - 1;

/** A scheduled callback of the `SystemScheduler`. */
interface SystemTimer {
  timeout?: NodeJS.Timeout;
  cancelled: boolean;
}

/**
 * The production `Scheduler`, on `setTimeout`. A callback further away than one timer can wait is
 * re-armed until its instant. Timers are unreferenced, so a pending one never keeps the process
 * alive.
 */
@Injectable()
export class SystemScheduler extends Scheduler {
  /**
   * @param {Clock} clock - The time source the delay is computed from.
   */
  constructor(private readonly clock: Clock) {
    super();
  }

  /**
   * @param {Date} at - The instant to fire at.
   * @param {() => void} fn - The callback, run once.
   * @returns {SchedulerHandle} The handle, for `cancel`.
   */
  schedule(at: Date, fn: () => void): SchedulerHandle {
    const timer: SystemTimer = { cancelled: false };

    this.#arm(timer, at, fn);

    return timer;
  }

  /**
   * @param {SchedulerHandle} handle - The handle `schedule` returned.
   * @returns {void}
   */
  cancel(handle: SchedulerHandle): void {
    const timer = handle as SystemTimer;

    timer.cancelled = true;
    clearTimeout(timer.timeout);
  }

  /**
   * @param {SystemTimer} timer - The timer record.
   * @param {Date} at - The instant to fire at.
   * @param {() => void} fn - The callback.
   * @returns {void}
   */
  #arm(timer: SystemTimer, at: Date, fn: () => void): void {
    const remaining = Math.max(0, at.getTime() - this.clock.now().getTime());

    timer.timeout = setTimeout(() => {
      if (timer.cancelled) return;
      if (remaining > MAX_TIMER_MS) return this.#arm(timer, at, fn);
      fn();
    }, Math.min(remaining, MAX_TIMER_MS));
    timer.timeout.unref();
  }
}
