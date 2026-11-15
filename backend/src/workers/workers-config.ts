import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getNumberConfig } from '../core/numeric-config.js';

/** Default number of workers in the pool. */
export const DEFAULT_WORKERS_POOL_SIZE = 3;
/** Default cooldown before a failed job is retried (5 s). */
export const DEFAULT_WORKERS_COOLDOWN_MS = 5_000;
/** Default maximum number of retries before a job is dead. */
export const DEFAULT_WORKERS_MAX_RETRIES = 3;
/** Default engine sleep between loop iterations (500 ms). */
export const DEFAULT_WORKERS_SLEEP_MS = 500;
/** Fixed bound on how long shutdown waits for busy workers (10 s). */
export const WORKERS_DRAIN_TIMEOUT_MS = 10_000;
/** Fixed interval at which shutdown polls for busy workers (100 ms). */
export const WORKERS_DRAIN_POLL_MS = 100;

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
 * The background-workers values, read once from
 * `KERGHAN_WORKERS_POOL_SIZE`, `_COOLDOWN_MS`, `_MAX_RETRIES` and `_SLEEP_MS`.
 * Invalid values fall back to the defaults and never fail boot.
 */
@Injectable()
export class WorkersConfig {
  readonly poolSize: number;
  readonly cooldownMs: number;
  readonly maxRetries: number;
  readonly sleepMs: number;
  readonly drainTimeoutMs: number = WORKERS_DRAIN_TIMEOUT_MS;
  readonly drainPollMs: number = WORKERS_DRAIN_POLL_MS;

  /**
   * @param {ConfigService} configService - Supplies the env values.
   */
  constructor(configService: ConfigService) {
    this.poolSize = positiveInteger(configService, 'KERGHAN_WORKERS_POOL_SIZE', DEFAULT_WORKERS_POOL_SIZE);
    this.cooldownMs = positiveInteger(configService, 'KERGHAN_WORKERS_COOLDOWN_MS', DEFAULT_WORKERS_COOLDOWN_MS);
    this.maxRetries = positiveInteger(configService, 'KERGHAN_WORKERS_MAX_RETRIES', DEFAULT_WORKERS_MAX_RETRIES);
    this.sleepMs = positiveInteger(configService, 'KERGHAN_WORKERS_SLEEP_MS', DEFAULT_WORKERS_SLEEP_MS);
  }
}
