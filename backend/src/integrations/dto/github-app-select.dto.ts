import { IsString, Matches } from 'class-validator';
import { IsInstallationId } from './github-app-installation-id.js';
import { GITHUB_APP_STATE_PATTERN } from '../types/github-app/github-app-state.service.js';

/**
 * Request body for `POST /integrations/github_app/select.json`: the
 * selection's `state` and the chosen `installationId`. The messages never
 * echo the `state`.
 */
export class GithubAppSelectDto {
  @IsString({ message: 'state must be a string' })
  @Matches(GITHUB_APP_STATE_PATTERN, { message: 'state is malformed' })
    state!: string;

  @IsInstallationId()
    installationId!: number;
}
