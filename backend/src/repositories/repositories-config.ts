import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getNumberConfig } from '../core/numeric-config.js';

/** Default staleness TTL (1 h). */
export const DEFAULT_SYNC_TTL_MS = 3_600_000;
/** Default Refresh cooldown, from the start of any sync (5 min). */
export const DEFAULT_SYNC_COOLDOWN_MS = 300_000;
/** Default page cap per source (10 pages of 100). */
export const DEFAULT_SYNC_PAGE_CAP = 10;
/** A `syncing` row with no heartbeat for this long is dead (2 min). */
export const SYNC_LEASE_MS = 120_000;
/** One sync is bounded by this hard deadline, checked between pages (5 min). */
export const SYNC_HARD_DEADLINE_MS = 300_000;
/** Up to this many sources run at once; pages within a source are sequential. */
export const SYNC_PARALLELISM = 3;
/** Repos per GitHub page (the Integrations client builds `per_page=100`). */
export const SYNC_PER_PAGE = 100;

/**
 * Reads a positive-integer env value, falling back to the default for an
 * unset, non-numeric, non-integer or non-positive value.
 * @param {ConfigService} configService - Supplies the raw value.
 * @param {string} key - The env var.
 * @param {number} fallback - The default.
 * @returns {number} The value.
 */
function positiveInteger(configService: ConfigService, key: string, fallback: number): number {
  const value = getNumberConfig(configService, key, fallback);

  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * The Repositories sync values (`docs/agents/specs/repos/sync.md#values`),
 * read once from `KERGHAN_REPOSITORIES_SYNC_TTL_MS`, `_COOLDOWN_MS` and
 * `_PAGE_CAP`.
 */
@Injectable()
export class RepositoriesConfig {
  readonly ttlMs: number;
  readonly cooldownMs: number;
  readonly pageCap: number;

  /**
   * @param {ConfigService} configService - Supplies the env values.
   */
  constructor(configService: ConfigService) {
    this.ttlMs = positiveInteger(configService, 'KERGHAN_REPOSITORIES_SYNC_TTL_MS', DEFAULT_SYNC_TTL_MS);
    this.cooldownMs = positiveInteger(configService, 'KERGHAN_REPOSITORIES_SYNC_COOLDOWN_MS', DEFAULT_SYNC_COOLDOWN_MS);
    this.pageCap = positiveInteger(configService, 'KERGHAN_REPOSITORIES_SYNC_PAGE_CAP', DEFAULT_SYNC_PAGE_CAP);
  }
}
