import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LoggerService } from '../core/logger.service.js';
import { WorkersService } from '../workers/workers.service.js';

/** The identity marker carried by every probe body. */
const APP = 'kerghan';

// Two levels up from this file is the package root, both from `src/health/`
// and from the compiled `dist/health/`.
const PACKAGE_JSON_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');

/** State of one readiness dependency check. */
export type CheckState = 'up' | 'down';

/** Per-dependency readiness checks, keyed by dependency name. */
export interface ReadinessChecks {
  database: CheckState;
  workers: CheckState;
}

/** Overall verdict of the checks, as derived from {@link ReadinessChecks}. */
export type ProbeStatus = 'ok' | 'degraded' | 'error';

/** Body of the liveness probe. `version` is absent when it could not be read. */
export interface LivenessResult {
  app: typeof APP;
  status: 'ok';
  version?: string;
}

/**
 * Body of the readiness probe. Never carries error details — failures are
 * logged instead. `version` is absent when it could not be read.
 */
export interface ReadinessResult {
  app: typeof APP;
  status: ProbeStatus;
  version?: string;
  checks: ReadinessChecks;
}

/**
 * Derives the overall status: the database is fatal, the worker pool is not.
 * @param {ReadinessChecks} checks - The per-dependency states.
 * @returns {ProbeStatus} `'error'` when the database is not up, else
 *   `'degraded'` when the workers are not up, else `'ok'`.
 */
function deriveStatus({ database, workers }: ReadinessChecks): ProbeStatus {
  if (database !== 'up') return 'error';

  return workers === 'up' ? 'ok' : 'degraded';
}

/**
 * Probe bodies behind `GET /health.json` and `GET /ready.json`, kept out of
 * `HealthController` so the controller stays thin. Only the database and the
 * in-process worker pool are checked; SMTP and the GitHub API are
 * deliberately not (a readiness probe must not flap on third-party outages).
 */
@Injectable()
export class HealthService {
  private readonly dataSource: DataSource;
  private readonly logger: LoggerService;
  private readonly workersService: WorkersService;
  private readonly version?: string;
  #workersWarned = false;

  /**
   * @param {DataSource} dataSource - The TypeORM connection to probe.
   * @param {LoggerService} logger - The injected Core logger, used to record
   *   check failures without exposing them to the caller.
   * @param {WorkersService} workersService - Tells whether the worker pool runs.
   * @param {string} [packageJsonPath] - Where the release version is read from,
   *   once, at construction. Nothing provides it through DI; specs override it.
   */
  constructor(
    dataSource: DataSource,
    logger: LoggerService,
    workersService: WorkersService,
    @Optional() packageJsonPath: string = PACKAGE_JSON_PATH,
  ) {
    this.dataSource = dataSource;
    this.logger = logger;
    this.workersService = workersService;
    this.version = this.#readVersion(packageJsonPath);
  }

  /**
   * Identity and liveness: proves the process is up, touching no dependency.
   * @returns {LivenessResult} The marker, `status: 'ok'` and the version.
   */
  liveness(): LivenessResult {
    return { app: APP, status: 'ok', ...this.#versionField() };
  }

  /**
   * Runs every readiness check and derives the overall status.
   * @returns {Promise<ReadinessResult>} The marker, the status, the version
   *   and the per-check map.
   */
  async checkReadiness(): Promise<ReadinessResult> {
    const checks: ReadinessChecks = {
      database: await this.#checkDatabase(),
      workers: this.#checkWorkers(),
    };

    return { app: APP, status: deriveStatus(checks), ...this.#versionField(), checks };
  }

  async #checkDatabase(): Promise<CheckState> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'up';
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error('readiness check failed', {
        context: 'HealthService',
        check: 'database',
        reason,
      });
      return 'down';
    }
  }

  // Warns once per transition to down, so frequent probes do not flood the log.
  #checkWorkers(): CheckState {
    const running = this.workersService.isRunning();

    if (!running && !this.#workersWarned) {
      this.logger.warn('readiness check failed', { context: 'HealthService', check: 'workers' });
    }
    this.#workersWarned = !running;

    return running ? 'up' : 'down';
  }

  #versionField(): { version?: string } {
    return this.version === undefined ? {} : { version: this.version };
  }

  #readVersion(path: string): string | undefined {
    let errorClass: string | undefined;

    try {
      const { version } = JSON.parse(readFileSync(path, 'utf8')) as { version?: unknown };

      if (typeof version === 'string' && version !== '') return version;
    } catch (error) {
      errorClass = error instanceof Error ? error.constructor.name : typeof error;
    }
    this.logger.warn('release version unavailable', { context: 'HealthService', errorClass });

    return undefined;
  }
}
