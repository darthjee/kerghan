import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import type { AccessTokenPayload } from '../core/access-token-payload.js';
import { CacheClass } from '../core/cache-class.js';
import { CachePolicy } from '../core/cache-policy.decorator.js';
import { CurrentUser } from '../core/current-user.decorator.js';
import { CreateIntegrationDto } from './dto/create-integration.dto.js';
import { RenameIntegrationDto } from './dto/rename-integration.dto.js';
import { ReplaceCredentialDto } from './dto/replace-credential.dto.js';
import type { IntegrationResponse } from './integration-response.js';
import { IntegrationsService } from './integrations.service.js';
import type { EnabledIntegrationType } from './types/integration-type-registry.js';

/**
 * Integrations routes — thin, delegating everything to
 * `IntegrationsService` (see `docs/agents/backend/routes/integrations.md`).
 * Every route sits behind the global `JwtGuard` (no `@Public()`, no
 * `@AdminOnly()`) and is scoped to the caller from `@CurrentUser()`; user-
 * scoped reads use `POST`. Cache class `never` at controller level, so
 * every response carries `X-Skip-Cache` and `Cache-Control: no-store`.
 *
 * Paths are declared in full (no controller prefix) because
 * `POST /integrations.json` has no `/` between the resource and `.json`.
 */
@Controller()
@CachePolicy(CacheClass.Never)
export class IntegrationsController {
  private readonly integrationsService: IntegrationsService;

  /**
   * @param {IntegrationsService} integrationsService - The module's business logic.
   */
  constructor(integrationsService: IntegrationsService) {
    this.integrationsService = integrationsService;
  }

  /**
   * `POST /integrations/mine.json`. Lists the caller's integrations, newest first.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<object>} `{ integrations }`.
   */
  @Post('integrations/mine.json')
  @HttpCode(HttpStatus.OK)
  async mine(@CurrentUser() user: AccessTokenPayload): Promise<{ integrations: IntegrationResponse[] }> {
    return { integrations: await this.integrationsService.list(user.sub) };
  }

  /**
   * `POST /integrations/types.json`. Lists the types this server can create.
   * @returns {object} `{ types }`.
   */
  @Post('integrations/types.json')
  @HttpCode(HttpStatus.OK)
  types(): { types: EnabledIntegrationType[] } {
    return { types: this.integrationsService.enabledTypes() };
  }

  /**
   * `POST /integrations/:uuid/show.json`. Shows one of the caller's integrations.
   * @param {string} uuid - The integration's uuid.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<IntegrationResponse>} The integration.
   */
  @Post('integrations/:uuid/show.json')
  @HttpCode(HttpStatus.OK)
  show(@Param('uuid') uuid: string, @CurrentUser() user: AccessTokenPayload): Promise<IntegrationResponse> {
    return this.integrationsService.show(user.sub, uuid);
  }

  /**
   * `POST /integrations.json`. Creates an integration from a pasted credential (201).
   * @param {CreateIntegrationDto} dto - The create envelope.
   * @param {AccessTokenPayload} user - The caller (the owner).
   * @returns {Promise<IntegrationResponse>} The created integration.
   */
  @Post('integrations.json')
  create(@Body() dto: CreateIntegrationDto, @CurrentUser() user: AccessTokenPayload): Promise<IntegrationResponse> {
    return this.integrationsService.create(user.sub, dto);
  }

  /**
   * `PATCH /integrations/:uuid.json`. Renames one of the caller's integrations.
   * @param {string} uuid - The integration's uuid.
   * @param {RenameIntegrationDto} dto - The new label.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<IntegrationResponse>} The renamed integration.
   */
  @Patch('integrations/:uuid.json')
  rename(
    @Param('uuid') uuid: string,
    @Body() dto: RenameIntegrationDto,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<IntegrationResponse> {
    return this.integrationsService.rename(user.sub, uuid, dto.label);
  }

  /**
   * `POST /integrations/:uuid/credential.json`. Replaces the credential.
   * @param {string} uuid - The integration's uuid.
   * @param {ReplaceCredentialDto} dto - The new credential.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<IntegrationResponse>} The updated integration.
   */
  @Post('integrations/:uuid/credential.json')
  @HttpCode(HttpStatus.OK)
  replaceCredential(
    @Param('uuid') uuid: string,
    @Body() dto: ReplaceCredentialDto,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<IntegrationResponse> {
    return this.integrationsService.replaceCredential(user.sub, uuid, dto);
  }

  /**
   * `POST /integrations/:uuid/test.json`. Tests the connection to GitHub.
   * @param {string} uuid - The integration's uuid.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<IntegrationResponse>} The integration with the test outcome.
   */
  @Post('integrations/:uuid/test.json')
  @HttpCode(HttpStatus.OK)
  test(@Param('uuid') uuid: string, @CurrentUser() user: AccessTokenPayload): Promise<IntegrationResponse> {
    return this.integrationsService.test(user.sub, uuid);
  }

  /**
   * `DELETE /integrations/:uuid.json`. Deletes one of the caller's integrations (204).
   * @param {string} uuid - The integration's uuid.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<void>} Resolves once deleted.
   */
  @Delete('integrations/:uuid.json')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('uuid') uuid: string, @CurrentUser() user: AccessTokenPayload): Promise<void> {
    return this.integrationsService.delete(user.sub, uuid);
  }
}
