import { IsIntegrationLabel } from './integration-label.js';

/** Request body for `PATCH /integrations/:uuid.json`. */
export class RenameIntegrationDto {
  @IsIntegrationLabel()
    label!: string;
}
