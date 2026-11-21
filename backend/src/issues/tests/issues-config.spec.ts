import { ConfigService } from '@nestjs/config';
import { IssuesConfig } from '../issues-config.js';

function configOf(values: Record<string, unknown>): IssuesConfig {
  return new IssuesConfig({ get: (key: string) => values[key] } as unknown as ConfigService);
}

const KEYS: Array<[string, keyof IssuesConfig, number]> = [
  ['KERGHAN_ISSUES_SYNC_MAX_RETRIES', 'syncMaxRetries', 5],
  ['KERGHAN_ISSUES_SYNC_COOLDOWN_MS', 'syncCooldownMs', 30_000],
  ['KERGHAN_ISSUES_SYNC_STALE_AFTER_SECONDS', 'syncStaleAfterSeconds', 3_600],
  ['KERGHAN_ISSUES_MAX_PROJECTS_PER_USER', 'maxProjectsPerUser', 100],
  ['KERGHAN_ISSUES_MAX_ISSUES_PER_PROJECT', 'maxIssuesPerProject', 5_000],
  ['KERGHAN_ISSUES_LINK_MAX_PER_WINDOW', 'linkMaxPerWindow', 30],
  ['KERGHAN_ISSUES_LINK_WINDOW_MS', 'linkWindowMs', 60_000],
  ['KERGHAN_ISSUES_EDIT_MAX_PER_WINDOW', 'editMaxPerWindow', 120],
  ['KERGHAN_ISSUES_EDIT_WINDOW_MS', 'editWindowMs', 60_000],
];

describe('IssuesConfig', () => {
  it.each(KEYS)('%s defaults %s to %d when unset', (_key, field, fallback) => {
    expect(configOf({})[field]).toBe(fallback);
  });

  it.each(KEYS)('%s reads a valid value into %s', (key, field) => {
    expect(configOf({ [key]: '7' })[field]).toBe(7);
  });

  describe.each(['abc', '0', '-5', '1.5', ''])('with the raw value %p', (raw) => {
    it.each(KEYS)('%s falls back to the default of %s (%d)', (key, field, fallback) => {
      expect(configOf({ [key]: raw })[field]).toBe(fallback);
    });
  });
});
