import { IsUUID, ValidateIf } from 'class-validator';
import { IsIntegrationLabel } from './integration-label.js';
import { isGiven } from './is-given.js';

/**
 * Request body for `POST /integrations/oauth_app/start.json`: `label`
 * (create) or `integrationId` (replace credential). Exactly one of them is
 * required; `OauthAppFlowService#start` enforces it (400 `VALIDATION_FAILED`).
 */
export class StartOauthAppDto {
  @ValidateIf(isGiven)
  @IsIntegrationLabel()
    label?: string;

  @ValidateIf(isGiven)
  @IsUUID()
    integrationId?: string;
}
