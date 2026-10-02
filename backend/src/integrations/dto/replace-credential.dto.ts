import { IsObject } from 'class-validator';

/**
 * Request body for `POST /integrations/:uuid/credential.json`. The
 * `credential` object is validated by the row's type strategy.
 */
export class ReplaceCredentialDto {
  @IsObject()
    credential!: Record<string, unknown>;
}
