import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { IsIntegrationLabel } from './integration-label.js';
import type { GithubAppMode } from '../types/github-app/github-app-urls.js';

// The modes start accepts.
export const GITHUB_APP_MODES: GithubAppMode[] = ['install', 'connect'];

/**
 * Request body for `POST /integrations/github_app/start.json`: `label`
 * (create) or `integrationId` (replace credential), and an optional `mode`
 * (`install`, the default, or `connect`). Exactly one of `label` and
 * `integrationId` is required; `GithubAppFlowService#start` enforces it
 * (400 `VALIDATION_FAILED`).
 */
export class StartGithubAppDto {
  @IsOptional()
  @IsIntegrationLabel()
    label?: string;

  @IsOptional()
  @IsUUID()
    integrationId?: string;

  @IsOptional()
  @IsIn(GITHUB_APP_MODES, { message: 'mode must be install or connect' })
    mode?: GithubAppMode;
}
