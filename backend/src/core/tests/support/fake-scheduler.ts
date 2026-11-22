import type { FakeClock } from './fake-clock.js';
import { Scheduler, type SchedulerHandle } from '../../scheduler.js';

interface FakeTimer {
  at: Date;
  fn: () => void;
  order: number;
}

/**
 * A test `Scheduler` driven by the `FakeClock`: nothing fires by itself. `advance(ms)` moves the
 * clock and runs every callback that came due, earliest first (a callback may schedule another one
 * that is already due, and it runs in the same call).
 */
export class FakeScheduler extends Scheduler {
  readonly #clock: FakeClock;
  #timers: FakeTimer[] = [];
  #counter = 0;

  constructor(clock: FakeClock) {
    super();
    this.#clock = clock;
  }

  schedule(at: Date, fn: () => void): SchedulerHandle {
    const timer: FakeTimer = { at: new Date(at.getTime()), fn, order: this.#counter };

    this.#counter += 1;
    this.#timers.push(timer);

    return timer;
  }

  cancel(handle: SchedulerHandle): void {
    this.#timers = this.#timers.filter((timer) => timer !== handle);
  }

  /** The instants of the callbacks still waiting, earliest first. */
  get pending(): Date[] {
    return [...this.#timers].sort(byDue).map((timer) => new Date(timer.at.getTime()));
  }

  /** Moves the clock forward and fires every callback that came due. */
  advance(ms: number): void {
    this.#clock.advance(ms);
    this.runDue();
  }

  /** Fires every callback due at the clock's current time, earliest first. */
  runDue(): void {
    for (;;) {
      const next = [...this.#timers].sort(byDue).find((timer) => timer.at.getTime() <= this.#clock.now().getTime());

      if (next === undefined) return;
      this.#timers = this.#timers.filter((timer) => timer !== next);
      next.fn();
    }
  }
}

function byDue(a: FakeTimer, b: FakeTimer): number {
  return a.at.getTime() - b.at.getTime() || a.order - b.order;
}
