import { Inject, Injectable } from '@nestjs/common';
import { GITHUB_APP_CONFIG, GithubAppConfig } from './github-app-config.js';
import { LoggerService } from '../../../core/logger.service.js';
import { GithubClientError, GithubClientService } from '../../github-client.service.js';
import type { Secret } from '../../secret.js';

/**
 * Best-effort revocation of the GitHub App user-to-server token obtained by
 * the callback's code exchange (`DELETE /applications/{client_id}/token`,
 * with the GitHub App's client id and secret). See
 * `docs/agents/modules/integrations/github-app.md#user-token`.
 */
@Injectable()
export class GithubAppRevocationService {
  private readonly github: GithubClientService;
  private readonly logger: LoggerService;
  private readonly config: GithubAppConfig;

  /**
   * @param {GithubClientService} github - The shared GitHub client.
   * @param {LoggerService} logger - Logs failed revocations, with safe fields only.
   * @param {GithubAppConfig} config - The GitHub App server config.
   */
  constructor(github: GithubClientService, logger: LoggerService, @Inject(GITHUB_APP_CONFIG) config: GithubAppConfig) {
    this.github = github;
    this.logger = logger;
    this.config = config;
  }

  /**
   * Revokes one user token. Any failure is logged at warn level (user id and
   * GitHub status or failure reason only) and swallowed.
   * @param {Secret<string>} token - The user token.
   * @param {number} userId - The Kerghan user, for the logs.
   * @returns {Promise<void>} Resolves once done; never throws.
   */
  async revoke(token: Secret<string>, userId: number): Promise<void> {
    const fields = { type: 'github_app', userId };

    if (!this.config.enabled) {
      this.logger.warn('github app token revocation skipped', { ...fields, reason: 'type_disabled' });
      return;
    }

    try {
      const { status } = await this.github.revokeOauthToken({
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        token,
      });

      if (status !== 204) {
        this.logger.warn('github app token revocation failed', { ...fields, githubStatus: status });
      }
    } catch (error) {
      this.logger.warn('github app token revocation failed', {
        ...fields,
        reason: error instanceof GithubClientError ? error.reason : 'unexpected_error',
      });
    }
  }
}
