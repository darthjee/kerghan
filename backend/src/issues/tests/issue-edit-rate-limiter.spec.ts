import { ConfigService } from '@nestjs/config';
import { FakeClock } from '../../core/tests/support/fake-clock.js';
import { IssueEditRateLimiter } from '../issue-edit-rate-limiter.js';
import { IssuesConfig } from '../issues-config.js';

const OWNER = 1;
const INTRUDER = 2;

function build(values: Record<string, unknown> = {}): { clock: FakeClock; limiter: IssueEditRateLimiter } {
  const clock = new FakeClock(new Date('2026-11-07T12:00:00Z'));
  const config = new IssuesConfig({ get: (key: string) => values[key] } as unknown as ConfigService);

  return { clock, limiter: new IssueEditRateLimiter(clock, config) };
}

function consumeTimes(limiter: IssueEditRateLimiter, userId: number, times: number): void {
  for (let i = 0; i < times; i += 1) {
    expect(limiter.consume(userId)).toEqual({ allowed: true });
  }
}

describe('IssueEditRateLimiter', () => {
  it('allows the 120th edit and refuses the 121st', () => {
    const { limiter } = build();

    consumeTimes(limiter, OWNER, 120);

    expect(limiter.consume(OWNER)).toEqual({ allowed: false, retryAfterMs: 60_000 });
  });

  it('answers the delay until the window ends, then reopens the window', () => {
    const { clock, limiter } = build();

    consumeTimes(limiter, OWNER, 120);
    clock.advance(45_000);

    expect(limiter.consume(OWNER)).toEqual({ allowed: false, retryAfterMs: 15_000 });

    clock.advance(15_000);
    expect(limiter.consume(OWNER)).toEqual({ allowed: true });
  });

  it('leaves the count unchanged on a refusal, so a lighter call can still pass', () => {
    const { limiter } = build({ KERGHAN_ISSUES_EDIT_MAX_PER_WINDOW: 10 });

    expect(limiter.consume(OWNER, 8)).toEqual({ allowed: true });
    expect(limiter.consume(OWNER, 3)).toEqual({ allowed: false, retryAfterMs: 60_000 });
    expect(limiter.consume(OWNER, 2)).toEqual({ allowed: true });
    expect(limiter.consume(OWNER)).toEqual({ allowed: false, retryAfterMs: 60_000 });
  });

  it('adds weights up and refuses all-or-nothing when used plus weight exceeds the maximum', () => {
    const { limiter } = build({ KERGHAN_ISSUES_EDIT_MAX_PER_WINDOW: 10 });

    expect(limiter.consume(OWNER, 4)).toEqual({ allowed: true });
    expect(limiter.consume(OWNER, 6)).toEqual({ allowed: true });
    expect(limiter.consume(OWNER, 1)).toEqual({ allowed: false, retryAfterMs: 60_000 });
  });

  it('always refuses a weight above the maximum, even on a fresh window, consuming nothing', () => {
    const { limiter } = build({ KERGHAN_ISSUES_EDIT_MAX_PER_WINDOW: 10 });

    expect(limiter.consume(OWNER, 11)).toEqual({ allowed: false, retryAfterMs: 60_000 });
    expect(limiter.trackedUsers()).toBe(0);
    expect(limiter.consume(OWNER, 10)).toEqual({ allowed: true });
  });

  it('starts a fresh window at the weight of the call', () => {
    const { clock, limiter } = build({ KERGHAN_ISSUES_EDIT_MAX_PER_WINDOW: 10 });

    expect(limiter.consume(OWNER, 10)).toEqual({ allowed: true });
    clock.advance(60_000);

    expect(limiter.consume(OWNER, 7)).toEqual({ allowed: true });
    expect(limiter.consume(OWNER, 4)).toEqual({ allowed: false, retryAfterMs: 60_000 });
  });

  it('isolates users', () => {
    const { limiter } = build();

    consumeTimes(limiter, OWNER, 120);

    expect(limiter.consume(OWNER).allowed).toBe(false);
    expect(limiter.consume(INTRUDER)).toEqual({ allowed: true });
  });

  it('sweeps expired windows so memory stays bounded', () => {
    const { clock, limiter } = build();

    limiter.consume(OWNER);
    limiter.consume(INTRUDER);
    expect(limiter.trackedUsers()).toBe(2);

    clock.advance(60_000);
    limiter.consume(3);

    expect(limiter.trackedUsers()).toBe(1);
  });
});
