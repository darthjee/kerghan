import { IsString, Matches } from 'class-validator';
import { OAUTH_STATE_PATTERN } from '../types/oauth-app/oauth-state.service.js';

// Shape of a GitHub OAuth code.
export const OAUTH_CODE_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;

/**
 * Request body for `POST /integrations/oauth_app/callback.json`. The
 * messages name the fields only, never echoing either value.
 */
export class OauthAppCallbackDto {
  @IsString({ message: 'code must be a string' })
  @Matches(OAUTH_CODE_PATTERN, { message: 'code is malformed' })
    code!: string;

  @IsString({ message: 'state must be a string' })
  @Matches(OAUTH_STATE_PATTERN, { message: 'state is malformed' })
    state!: string;
}
