import { Controller, Get, HttpCode } from '@nestjs/common';
import { Public } from '../core/public.decorator.js';

/**
 * Health-check endpoint used to prove the backend is up and reachable
 * through the proxy. Replaces the old Express `HealthHandler`. Public: the
 * proxy/orchestrator must be able to hit it without an access token.
 */
@Controller()
export class HealthController {
  @Public()
  @Get('health.json')
  @HttpCode(200)
  check(): { status: string } {
    return { status: 'ok' };
  }
}
