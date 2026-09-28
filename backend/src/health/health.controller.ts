import { Controller, Get, HttpCode } from '@nestjs/common';
import { CacheClass } from '../core/cache-class.js';
import { CachePolicy } from '../core/cache-policy.decorator.js';
import { Public } from '../core/public.decorator.js';

/**
 * Health-check endpoint used to prove the backend is up and reachable
 * through the proxy. Replaces the old Express `HealthHandler`. Public: the
 * proxy/orchestrator must be able to hit it without an access token.
 * `@CachePolicy(CacheClass.Never)`: a health check must always reach the
 * backend, never be answered from Tent's cache.
 */
@Controller()
@CachePolicy(CacheClass.Never)
export class HealthController {
  @Public()
  @Get('health.json')
  @HttpCode(200)
  check(): { status: string } {
    return { status: 'ok' };
  }
}
