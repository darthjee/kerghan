import { IsOptional, IsUUID } from 'class-validator';
import { IsIntegrationLabel } from './integration-label.js';

/**
 * Request body for `POST /integrations/oauth_app/start.json`: `label`
 * (create) or `integrationId` (replace credential). Exactly one of them is
 * required; `OauthAppFlowService#start` enforces it (400 `VALIDATION_FAILED`).
 */
export class StartOauthAppDto {
  @IsOptional()
  @IsIntegrationLabel()
    label?: string;

  @IsOptional()
  @IsUUID()
    integrationId?: string;
}
