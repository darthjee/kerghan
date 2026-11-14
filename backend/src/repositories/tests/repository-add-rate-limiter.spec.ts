import { ConfigService } from '@nestjs/config';
import { FakeClock } from '../../core/tests/support/fake-clock.js';
import { RepositoriesConfig } from '../repositories-config.js';
import { RepositoryAddRateLimiter } from '../repository-add-rate-limiter.js';

const OWNER = 1;
const INTRUDER = 2;

function build(values: Record<string, unknown> = {}): { clock: FakeClock; limiter: RepositoryAddRateLimiter } {
  const clock = new FakeClock(new Date('2026-11-07T12:00:00Z'));
  const config = new RepositoriesConfig({ get: (key: string) => values[key] } as unknown as ConfigService);

  return { clock, limiter: new RepositoryAddRateLimiter(clock, config) };
}

function consumeTimes(limiter: RepositoryAddRateLimiter, userId: number, times: number): void {
  for (let i = 0; i < times; i += 1) {
    expect(limiter.consume(userId)).toEqual({ allowed: true });
  }
}

describe('RepositoryAddRateLimiter', () => {
  it('allows the 30th Add and refuses the 31st', () => {
    const { limiter } = build();

    consumeTimes(limiter, OWNER, 30);

    expect(limiter.consume(OWNER)).toEqual({ allowed: false, retryAfterMs: 60_000 });
  });

  it('answers the delay until the window ends, then reopens the window', () => {
    const { clock, limiter } = build();

    consumeTimes(limiter, OWNER, 30);
    clock.advance(45_000);

    expect(limiter.consume(OWNER)).toEqual({ allowed: false, retryAfterMs: 15_000 });

    clock.advance(14_999);
    expect(limiter.consume(OWNER)).toEqual({ allowed: false, retryAfterMs: 1 });

    clock.advance(1);
    expect(limiter.consume(OWNER)).toEqual({ allowed: true });
  });

  it('counts refused attempts without extending the window', () => {
    const { clock, limiter } = build();

    consumeTimes(limiter, OWNER, 30);
    limiter.consume(OWNER);
    limiter.consume(OWNER);
    clock.advance(60_000);

    consumeTimes(limiter, OWNER, 30);
    expect(limiter.consume(OWNER)).toEqual({ allowed: false, retryAfterMs: 60_000 });
  });

  it('isolates users: the intruder is unaffected by the owner reaching the limit', () => {
    const { limiter } = build();

    consumeTimes(limiter, OWNER, 30);

    expect(limiter.consume(OWNER).allowed).toBe(false);
    consumeTimes(limiter, INTRUDER, 30);
    expect(limiter.consume(INTRUDER).allowed).toBe(false);
  });

  it('applies the env overrides', () => {
    const { clock, limiter } = build({
      KERGHAN_REPOSITORIES_ADD_MAX_PER_WINDOW: '2',
      KERGHAN_REPOSITORIES_ADD_WINDOW_MS: '1000',
    });

    consumeTimes(limiter, OWNER, 2);
    expect(limiter.consume(OWNER)).toEqual({ allowed: false, retryAfterMs: 1_000 });

    clock.advance(1_000);
    expect(limiter.consume(OWNER)).toEqual({ allowed: true });
  });

  it('sweeps expired windows so idle users do not stay in memory', () => {
    const { clock, limiter } = build();

    for (let userId = 10; userId < 20; userId += 1) {
      limiter.consume(userId);
    }

    expect(limiter.trackedUsers()).toBe(10);

    clock.advance(60_000);
    limiter.consume(OWNER);

    expect(limiter.trackedUsers()).toBe(1);
  });

  it('sweeps at most once per window', () => {
    const { clock, limiter } = build();

    limiter.consume(10);
    clock.advance(30_000);
    limiter.consume(11);
    clock.advance(30_000);
    limiter.consume(OWNER);

    // The sweep at t=0 ran; the next one is due at t=60s, dropping only user 10.
    expect(limiter.trackedUsers()).toBe(2);
  });
});
