import { IsIn, IsObject } from 'class-validator';
import { INTEGRATION_PROVIDERS, INTEGRATION_TYPES } from '../integration-enums.js';
import { IsIntegrationLabel } from './integration-label.js';

/**
 * Request body for `POST /integrations.json` (the create envelope). The
 * `credential` object's shape is type-specific: it is validated by the
 * type's strategy (`parseCredential`), which rejects unknown fields.
 */
export class CreateIntegrationDto {
  @IsIntegrationLabel()
    label!: string;

  @IsIn(INTEGRATION_PROVIDERS)
    provider!: string;

  @IsIn(INTEGRATION_TYPES)
    type!: string;

  @IsObject()
    credential!: Record<string, unknown>;
}
