import { ConfigService } from '@nestjs/config';
import { WorkersConfig } from '../workers-config.js';

function configOf(values: Record<string, unknown>): WorkersConfig {
  return new WorkersConfig({ get: (key: string) => values[key] } as unknown as ConfigService);
}

const VARS: Array<[string, keyof WorkersConfig, number]> = [
  ['KERGHAN_WORKERS_POOL_SIZE', 'poolSize', 3],
  ['KERGHAN_WORKERS_COOLDOWN_MS', 'cooldownMs', 5000],
  ['KERGHAN_WORKERS_MAX_RETRIES', 'maxRetries', 3],
  ['KERGHAN_WORKERS_SLEEP_MS', 'sleepMs', 500],
];

describe('WorkersConfig', () => {
  it('applies the defaults and the fixed drain values', () => {
    const config = configOf({});

    expect(config.poolSize).toBe(3);
    expect(config.cooldownMs).toBe(5000);
    expect(config.maxRetries).toBe(3);
    expect(config.sleepMs).toBe(500);
    expect(config.drainTimeoutMs).toBe(10_000);
  });

  describe.each(VARS)('%s', (key, field, fallback) => {
    it.each(['abc', '1.5', '0', '-4', ''])('falls back for %p', (raw) => {
      expect(configOf({ [key]: raw })[field]).toBe(fallback);
    });

    it('uses a valid value', () => {
      expect(configOf({ [key]: '7' })[field]).toBe(7);
    });
  });
});
