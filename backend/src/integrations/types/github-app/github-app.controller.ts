import { Body, Controller, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { GithubAppEnabledGuard } from './github-app-enabled.guard.js';
import { GithubAppFlowService } from './github-app-flow.service.js';
import { GithubAppSelection, GithubAppSelectionService } from './github-app-selection.service.js';
import type { AccessTokenPayload } from '../../../core/access-token-payload.js';
import { CacheClass } from '../../../core/cache-class.js';
import { CachePolicy } from '../../../core/cache-policy.decorator.js';
import { CurrentUser } from '../../../core/current-user.decorator.js';
import { GithubAppCallbackDto } from '../../dto/github-app-callback.dto.js';
import { GithubAppSelectDto } from '../../dto/github-app-select.dto.js';
import { StartGithubAppDto } from '../../dto/start-github-app.dto.js';
import type { IntegrationResponse } from '../../integration-response.js';

/**
 * The GitHub App type-owned routes — thin, delegating everything to
 * `GithubAppFlowService` and `GithubAppSelectionService` (see
 * `docs/agents/specs/integrations/types/github-app.md#routes`). All sit
 * behind the global `JwtGuard` (no `@Public()`, no `@AdminOnly()`) and
 * `OriginGuard`, answer 404 while the type is disabled
 * (`GithubAppEnabledGuard`), and are cache class `never`. The owner is
 * always `@CurrentUser().sub`. Their literal paths can't collide with the
 * generic `integrations/:uuid/…` routes.
 */
@Controller()
@CachePolicy(CacheClass.Never)
@UseGuards(GithubAppEnabledGuard)
export class GithubAppController {
  private readonly flow: GithubAppFlowService;
  private readonly selection: GithubAppSelectionService;

  /**
   * @param {GithubAppFlowService} flow - Start and callback.
   * @param {GithubAppSelectionService} selection - Select.
   */
  constructor(flow: GithubAppFlowService, selection: GithubAppSelectionService) {
    this.flow = flow;
    this.selection = selection;
  }

  /**
   * `POST /integrations/github_app/start.json`. Answers the installation page or authorize URL.
   * @param {StartGithubAppDto} dto - `{ label }` or `{ integrationId }`, and `mode`.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<object>} `{ redirectUrl }`.
   */
  @Post('integrations/github_app/start.json')
  @HttpCode(HttpStatus.OK)
  start(@Body() dto: StartGithubAppDto, @CurrentUser() user: AccessTokenPayload): Promise<{ redirectUrl: string }> {
    return this.flow.start(user.sub, dto);
  }

  /**
   * `POST /integrations/github_app/callback.json`. 201 for a new
   * integration, 200 for a replaced one, or 200 with a selection.
   * @param {GithubAppCallbackDto} dto - `{ code, state }`, and `installationId`/`setupAction` when sent.
   * @param {AccessTokenPayload} user - The caller.
   * @param {Response} response - Used only to set the status.
   * @returns {Promise<IntegrationResponse | object>} The integration, or `{ selection }`.
   */
  @Post('integrations/github_app/callback.json')
  async callback(
    @Body() dto: GithubAppCallbackDto,
    @CurrentUser() user: AccessTokenPayload,
    @Res({ passthrough: true }) response: Response,
  ): Promise<IntegrationResponse | { selection: GithubAppSelection }> {
    const result = await this.flow.callback(user.sub, dto);

    if (result.kind === 'selection') {
      response.status(HttpStatus.OK);
      return { selection: result.selection };
    }

    response.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return result.integration;
  }

  /**
   * `POST /integrations/github_app/select.json`. 201 for a new integration, 200 for a replaced one.
   * @param {GithubAppSelectDto} dto - `{ state, installationId }`.
   * @param {AccessTokenPayload} user - The caller.
   * @param {Response} response - Used only to set the status.
   * @returns {Promise<IntegrationResponse>} The integration.
   */
  @Post('integrations/github_app/select.json')
  async select(
    @Body() dto: GithubAppSelectDto,
    @CurrentUser() user: AccessTokenPayload,
    @Res({ passthrough: true }) response: Response,
  ): Promise<IntegrationResponse> {
    const { created, integration } = await this.selection.select(user.sub, dto);

    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return integration;
  }
}
