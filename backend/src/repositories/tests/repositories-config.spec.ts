import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_SYNC_COOLDOWN_MS,
  DEFAULT_SYNC_PAGE_CAP,
  DEFAULT_SYNC_TTL_MS,
  RepositoriesConfig,
  SYNC_HARD_DEADLINE_MS,
  SYNC_LEASE_MS,
  SYNC_PARALLELISM,
  SYNC_PER_PAGE,
} from '../repositories-config.js';

function configOf(values: Record<string, unknown>): RepositoriesConfig {
  return new RepositoriesConfig({ get: (key: string) => values[key] } as unknown as ConfigService);
}

describe('RepositoriesConfig', () => {
  it('applies the defaults', () => {
    const config = configOf({});

    expect(config.ttlMs).toBe(3_600_000);
    expect(config.cooldownMs).toBe(300_000);
    expect(config.pageCap).toBe(10);
    expect([DEFAULT_SYNC_TTL_MS, DEFAULT_SYNC_COOLDOWN_MS, DEFAULT_SYNC_PAGE_CAP]).toEqual([3_600_000, 300_000, 10]);
  });

  it('reads the three env vars', () => {
    const config = configOf({
      KERGHAN_REPOSITORIES_SYNC_TTL_MS: '60000',
      KERGHAN_REPOSITORIES_SYNC_COOLDOWN_MS: '1000',
      KERGHAN_REPOSITORIES_SYNC_PAGE_CAP: '3',
    });

    expect(config.ttlMs).toBe(60_000);
    expect(config.cooldownMs).toBe(1_000);
    expect(config.pageCap).toBe(3);
  });

  it.each(['abc', '0', '-5', '1.5', ''])('falls back to the defaults for %p', (raw) => {
    const config = configOf({
      KERGHAN_REPOSITORIES_SYNC_TTL_MS: raw,
      KERGHAN_REPOSITORIES_SYNC_COOLDOWN_MS: raw,
      KERGHAN_REPOSITORIES_SYNC_PAGE_CAP: raw,
    });

    expect(config.ttlMs).toBe(DEFAULT_SYNC_TTL_MS);
    expect(config.cooldownMs).toBe(DEFAULT_SYNC_COOLDOWN_MS);
    expect(config.pageCap).toBe(DEFAULT_SYNC_PAGE_CAP);
  });

  it('exposes the constants', () => {
    expect(SYNC_LEASE_MS).toBe(120_000);
    expect(SYNC_HARD_DEADLINE_MS).toBe(300_000);
    expect(SYNC_PARALLELISM).toBe(3);
    expect(SYNC_PER_PAGE).toBe(100);
  });
});
