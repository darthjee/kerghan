import { SystemClock } from '../clock.js';
import { FakeClock } from './support/fake-clock.js';

describe('SystemClock', () => {
  it('returns the system time', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});

describe('FakeClock', () => {
  it('starts at the given date and moves only by hand', () => {
    const clock = new FakeClock(new Date('2026-05-01T00:00:00Z'));

    clock.advance(1_000);
    expect(clock.now().toISOString()).toBe('2026-05-01T00:00:01.000Z');

    clock.set(new Date('2027-01-01T00:00:00Z'));
    expect(clock.now().toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('returns a copy, so callers cannot move it', () => {
    const clock = new FakeClock();

    clock.now().setTime(0);
    expect(clock.now().getTime()).not.toBe(0);
  });
});
