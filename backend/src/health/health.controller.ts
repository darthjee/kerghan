import { Controller, Get, HttpCode } from '@nestjs/common';

/**
 * Health-check endpoint used to prove the backend is up and reachable
 * through the proxy. Replaces the old Express `HealthHandler`.
 */
@Controller()
export class HealthController {
  @Get('health.json')
  @HttpCode(200)
  check(): { status: string } {
    return { status: 'ok' };
  }
}
