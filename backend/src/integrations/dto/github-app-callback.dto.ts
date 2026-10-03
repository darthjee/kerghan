import {
  IsIn,
  IsString,
  Matches,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { IsInstallationId } from './github-app-installation-id.js';
import { OAUTH_CODE_PATTERN } from './oauth-app-callback.dto.js';
import { GITHUB_APP_STATE_PATTERN } from '../types/github-app/github-app-state.service.js';

/** The `setup_action` values the callback accepts (`request` never reaches the backend). */
export type GithubAppSetupAction = 'install' | 'update';

/**
 * `setupAction` is required when `installationId` is present and forbidden otherwise.
 */
@ValidatorConstraint({ name: 'setupActionMatchesInstallationId' })
export class SetupActionMatchesInstallationId implements ValidatorConstraintInterface {
  /**
   * @param {unknown} _value - Unused (the check reads both fields).
   * @param {ValidationArguments} args - Gives access to the whole body.
   * @returns {boolean} Whether both are present or both absent.
   */
  validate(_value: unknown, args: ValidationArguments): boolean {
    const body = args.object as GithubAppCallbackDto;

    return (body.installationId === undefined) === (body.setupAction === undefined);
  }

  /**
   * @returns {string} The field-only message.
   */
  defaultMessage(): string {
    return 'setupAction is required with installationId, and only then';
  }
}

/**
 * Request body for `POST /integrations/github_app/callback.json`:
 * `{ code, state }`, plus `installationId` and `setupAction` when GitHub's
 * redirect carried them. The messages name the fields only, never echoing
 * `code` or `state`.
 */
export class GithubAppCallbackDto {
  @IsString({ message: 'code must be a string' })
  @Matches(OAUTH_CODE_PATTERN, { message: 'code is malformed' })
    code!: string;

  @IsString({ message: 'state must be a string' })
  @Matches(GITHUB_APP_STATE_PATTERN, { message: 'state is malformed' })
    state!: string;

  @ValidateIf((body: GithubAppCallbackDto) => body.installationId !== undefined)
  @IsInstallationId()
    installationId?: number;

  @ValidateIf((body: GithubAppCallbackDto) => body.setupAction !== undefined || body.installationId !== undefined)
  @Validate(SetupActionMatchesInstallationId)
  @IsIn(['install', 'update'], { message: 'setupAction must be install or update' })
    setupAction?: GithubAppSetupAction;
}
