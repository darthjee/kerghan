import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService, type LivenessResult, type ReadinessResult } from './health.service.js';
import { CacheClass } from '../core/cache-class.js';
import { CachePolicy } from '../core/cache-policy.decorator.js';
import { Public } from '../core/public.decorator.js';

/**
 * Liveness and readiness probes. `GET /health.json` is the liveness probe:
 * it proves the process is up and reachable through the proxy, and that the
 * responder is Kerghan (`app`, plus the release `version`), without touching
 * any dependency. `GET /ready.json` is the readiness probe: it checks the
 * database and the worker pool and answers `503` only when the status is
 * `error` (database down); `degraded` (workers down) still answers `200`.
 * Both bodies come from {@link HealthService}. Both are public — the
 * proxy/orchestrator must be able to hit them without an access token.
 * `@CachePolicy(CacheClass.Never)`: a probe must always reach the backend,
 * never be answered from Tent's cache.
 */
@Controller()
@CachePolicy(CacheClass.Never)
export class HealthController {
  private readonly healthService: HealthService;

  /**
   * @param {HealthService} healthService - Builds the probe bodies.
   */
  constructor(healthService: HealthService) {
    this.healthService = healthService;
  }

  /**
   * Identity and liveness probe. Touches no dependency.
   * @returns {LivenessResult} `app`, `status: 'ok'` and, when known, `version`.
   */
  @Public()
  @Get('health.json')
  @HttpCode(200)
  check(): LivenessResult {
    return this.healthService.liveness();
  }

  /**
   * Readiness probe. Sets the status on the response instead of throwing so
   * the body keeps the probe contract rather than the global error shape.
   * @param {Response} res - Used to set `503` on `error`; `ok` and
   *   `degraded` answer `200`.
   * @returns {Promise<ReadinessResult>} The aggregated readiness result.
   */
  @Public()
  @Get('ready.json')
  async ready(@Res({ passthrough: true }) res: Response): Promise<ReadinessResult> {
    const result = await this.healthService.checkReadiness();
    res.status(result.status === 'error' ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK);
    return result;
  }
}
