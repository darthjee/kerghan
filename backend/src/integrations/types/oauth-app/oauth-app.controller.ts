import { Body, Controller, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { OauthAppEnabledGuard } from './oauth-app-enabled.guard.js';
import { OauthAppFlowService } from './oauth-app-flow.service.js';
import type { AccessTokenPayload } from '../../../core/access-token-payload.js';
import { CacheClass } from '../../../core/cache-class.js';
import { CachePolicy } from '../../../core/cache-policy.decorator.js';
import { CurrentUser } from '../../../core/current-user.decorator.js';
import { OauthAppCallbackDto } from '../../dto/oauth-app-callback.dto.js';
import { StartOauthAppDto } from '../../dto/start-oauth-app.dto.js';
import type { IntegrationResponse } from '../../integration-response.js';

/**
 * The OAuth App type-owned routes — thin, delegating everything to
 * `OauthAppFlowService` (see
 * `docs/agents/specs/integrations/types/oauth-app.md#routes`). Both sit
 * behind the global `JwtGuard` (no `@Public()`, no `@AdminOnly()`) and
 * `OriginGuard`, answer 404 while the type is disabled
 * (`OauthAppEnabledGuard`), and are cache class `never`. The owner is always
 * `@CurrentUser().sub`. Their literal paths can't collide with the generic
 * `integrations/:uuid/…` routes, which end in `/show.json`, `/test.json` or
 * `/credential.json`.
 */
@Controller()
@CachePolicy(CacheClass.Never)
@UseGuards(OauthAppEnabledGuard)
export class OauthAppController {
  private readonly flow: OauthAppFlowService;

  /**
   * @param {OauthAppFlowService} flow - The OAuth App redirect flow.
   */
  constructor(flow: OauthAppFlowService) {
    this.flow = flow;
  }

  /**
   * `POST /integrations/oauth_app/start.json`. Answers GitHub's authorize URL.
   * @param {StartOauthAppDto} dto - `{ label }` or `{ integrationId }`.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<object>} `{ authorizeUrl }`.
   */
  @Post('integrations/oauth_app/start.json')
  @HttpCode(HttpStatus.OK)
  start(@Body() dto: StartOauthAppDto, @CurrentUser() user: AccessTokenPayload): Promise<{ authorizeUrl: string }> {
    return this.flow.start(user.sub, dto);
  }

  /**
   * `POST /integrations/oauth_app/callback.json`. Stores the authorized token:
   * 201 for a new integration, 200 for a replaced credential.
   * @param {OauthAppCallbackDto} dto - `{ code, state }`.
   * @param {AccessTokenPayload} user - The caller.
   * @param {Response} response - Used only to set the status.
   * @returns {Promise<IntegrationResponse>} The integration.
   */
  @Post('integrations/oauth_app/callback.json')
  async callback(
    @Body() dto: OauthAppCallbackDto,
    @CurrentUser() user: AccessTokenPayload,
    @Res({ passthrough: true }) response: Response,
  ): Promise<IntegrationResponse> {
    const { created, integration } = await this.flow.callback(user.sub, dto);

    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);

    return integration;
  }
}
