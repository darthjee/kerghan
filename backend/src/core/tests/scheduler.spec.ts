import { SystemScheduler } from '../scheduler.js';
import { FakeClock } from './support/fake-clock.js';
import { FakeScheduler } from './support/fake-scheduler.js';

describe('SystemScheduler', () => {
  const start = new Date('2026-01-01T00:00:00Z');
  let clock: FakeClock;
  let scheduler: SystemScheduler;

  beforeEach(() => {
    jest.useFakeTimers();
    clock = new FakeClock(start);
    scheduler = new SystemScheduler(clock);
  });

  afterEach(() => jest.useRealTimers());

  it('fires the callback once, at the instant', () => {
    const fn = jest.fn();

    scheduler.schedule(new Date(start.getTime() + 5_000), fn);
    jest.advanceTimersByTime(4_999);
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    jest.advanceTimersByTime(60_000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fires an instant already past as soon as possible', () => {
    const fn = jest.fn();

    scheduler.schedule(new Date(start.getTime() - 1_000), fn);
    jest.advanceTimersByTime(0);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('never fires a cancelled callback', () => {
    const fn = jest.fn();
    const handle = scheduler.schedule(new Date(start.getTime() + 1_000), fn);

    scheduler.cancel(handle);
    jest.advanceTimersByTime(10_000);

    expect(fn).not.toHaveBeenCalled();
  });

  it('re-arms an instant further away than one timer can wait', () => {
    const fn = jest.fn();
    const day = 24 * 60 * 60 * 1_000;

    scheduler.schedule(new Date(start.getTime() + 30 * day), fn);
    jest.advanceTimersByTime(2 ** 31 - 1);
    clock.advance(2 ** 31 - 1);
    expect(fn).not.toHaveBeenCalled();

    clock.advance(30 * day - 2 ** 31 + 1);
    jest.advanceTimersByTime(30 * day);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not keep the process alive', () => {
    const handle = scheduler.schedule(new Date(start.getTime() + 1_000), jest.fn()) as { timeout: NodeJS.Timeout };

    expect(handle.timeout.hasRef()).toBe(false);
  });
});

describe('FakeScheduler', () => {
  let clock: FakeClock;
  let scheduler: FakeScheduler;

  beforeEach(() => {
    clock = new FakeClock(new Date('2026-01-01T00:00:00Z'));
    scheduler = new FakeScheduler(clock);
  });

  it('fires nothing until the clock advances past the instant', () => {
    const fn = jest.fn();

    scheduler.schedule(new Date(clock.now().getTime() + 1_000), fn);
    scheduler.runDue();
    scheduler.advance(999);
    expect(fn).not.toHaveBeenCalled();

    scheduler.advance(1);
    scheduler.advance(10_000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fires due callbacks earliest first, ties in scheduling order', () => {
    const order: string[] = [];
    const base = clock.now().getTime();

    scheduler.schedule(new Date(base + 2_000), () => order.push('late'));
    scheduler.schedule(new Date(base + 1_000), () => order.push('first'));
    scheduler.schedule(new Date(base + 1_000), () => order.push('second'));
    scheduler.advance(5_000);

    expect(order).toEqual(['first', 'second', 'late']);
  });

  it('runs a callback scheduled by a callback when it is already due', () => {
    const fn = jest.fn();

    scheduler.schedule(new Date(clock.now().getTime() + 1_000), () => {
      scheduler.schedule(clock.now(), fn);
    });
    scheduler.advance(1_000);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('drops a cancelled callback and lists the pending ones', () => {
    const fn = jest.fn();
    const base = clock.now().getTime();
    const handle = scheduler.schedule(new Date(base + 1_000), fn);

    scheduler.schedule(new Date(base + 3_000), jest.fn());
    expect(scheduler.pending).toEqual([new Date(base + 1_000), new Date(base + 3_000)]);

    scheduler.cancel(handle);
    scheduler.advance(10_000);

    expect(fn).not.toHaveBeenCalled();
    expect(scheduler.pending).toEqual([]);
  });
});
