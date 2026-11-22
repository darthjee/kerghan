import { ConfigService } from '@nestjs/config';
import { FakeClock } from '../../core/tests/support/fake-clock.js';
import { IssueLinkRateLimiter } from '../issue-link-rate-limiter.js';
import { IssuesConfig } from '../issues-config.js';

const OWNER = 1;
const OTHER = 2;

function build(values: Record<string, unknown> = {}): { clock: FakeClock; limiter: IssueLinkRateLimiter } {
  const clock = new FakeClock(new Date('2026-11-07T12:00:00Z'));
  const config = new IssuesConfig({ get: (key: string) => values[key] } as unknown as ConfigService);

  return { clock, limiter: new IssueLinkRateLimiter(clock, config) };
}

function consumeTimes(limiter: IssueLinkRateLimiter, userId: number, times: number): void {
  for (let i = 0; i < times; i += 1) {
    expect(limiter.consume(userId)).toEqual({ allowed: true });
  }
}

describe('IssueLinkRateLimiter', () => {
  it('allows the 30th link and refuses the 31st', () => {
    const { limiter } = build();

    consumeTimes(limiter, OWNER, 30);

    expect(limiter.consume(OWNER)).toEqual({ allowed: false, retryAfterMs: 60_000 });
  });

  it('honours the configured maximum and window', () => {
    const { clock, limiter } = build({ KERGHAN_ISSUES_LINK_MAX_PER_WINDOW: 2, KERGHAN_ISSUES_LINK_WINDOW_MS: 1_000 });

    consumeTimes(limiter, OWNER, 2);
    expect(limiter.consume(OWNER)).toEqual({ allowed: false, retryAfterMs: 1_000 });

    clock.advance(1_000);
    expect(limiter.consume(OWNER)).toEqual({ allowed: true });
  });

  it('answers the delay until the window ends, then reopens the window', () => {
    const { clock, limiter } = build();

    consumeTimes(limiter, OWNER, 30);
    clock.advance(45_000);

    expect(limiter.consume(OWNER)).toEqual({ allowed: false, retryAfterMs: 15_000 });

    clock.advance(15_000);
    expect(limiter.consume(OWNER)).toEqual({ allowed: true });
  });

  it('consumes nothing on a refusal', () => {
    const { limiter } = build({ KERGHAN_ISSUES_LINK_MAX_PER_WINDOW: 3 });

    expect(limiter.consume(OWNER, 2)).toEqual({ allowed: true });
    expect(limiter.consume(OWNER, 2)).toEqual({ allowed: false, retryAfterMs: 60_000 });
    expect(limiter.consume(OWNER)).toEqual({ allowed: true });
    expect(limiter.consume(OWNER)).toEqual({ allowed: false, retryAfterMs: 60_000 });
  });

  it('keeps users apart', () => {
    const { limiter } = build({ KERGHAN_ISSUES_LINK_MAX_PER_WINDOW: 1 });

    expect(limiter.consume(OWNER)).toEqual({ allowed: true });
    expect(limiter.consume(OWNER).allowed).toBe(false);
    expect(limiter.consume(OTHER)).toEqual({ allowed: true });
  });

  it('sweeps expired windows', () => {
    const { clock, limiter } = build();

    limiter.consume(OWNER);
    limiter.consume(OTHER);
    expect(limiter.trackedUsers()).toBe(2);

    clock.advance(60_000);
    limiter.consume(3);

    expect(limiter.trackedUsers()).toBe(1);
  });
});
