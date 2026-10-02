import { Inject, Injectable } from '@nestjs/common';
import { OAUTH_APP_CONFIG, OauthAppConfig } from './oauth-app-config.js';
import { LoggerService } from '../../../core/logger.service.js';
import { GithubClientError, GithubClientService } from '../../github-client.service.js';
import type { Secret } from '../../secret.js';

/** Safe fields identifying a revocation in the logs (never the token). */
export interface RevocationLogContext {
  integrationUuid?: string;
  userId?: number;
}

/**
 * Best-effort revocation of single OAuth App user access tokens
 * (`DELETE /applications/{client_id}/token`; never the `/grant` endpoint),
 * used on delete, on replace (the previous token) and on callback failures
 * (the new token). See `docs/agents/specs/integrations/types/oauth-app.md#revocation`.
 */
@Injectable()
export class OauthAppRevocationService {
  private readonly github: GithubClientService;
  private readonly logger: LoggerService;
  private readonly config: OauthAppConfig;

  /**
   * @param {GithubClientService} github - The shared GitHub client.
   * @param {LoggerService} logger - Logs skipped and failed revocations, with safe fields only.
   * @param {OauthAppConfig} config - The OAuth App server config.
   */
  constructor(github: GithubClientService, logger: LoggerService, @Inject(OAUTH_APP_CONFIG) config: OauthAppConfig) {
    this.github = github;
    this.logger = logger;
    this.config = config;
  }

  /**
   * Revokes one token. Skipped (and logged) when the type is disabled or the
   * token was issued to another client id; any failure is logged at warn
   * level and swallowed.
   * @param {Secret<string>} token - The token.
   * @param {string | null} clientIdOfToken - The client id the token was issued to, when known.
   * @param {RevocationLogContext} [context] - Safe fields for the logs.
   * @returns {Promise<void>} Resolves once done; never throws.
   */
  async revoke(token: Secret<string>, clientIdOfToken: string | null, context: RevocationLogContext = {}): Promise<void> {
    const fields = { type: 'oauth_app', ...context };

    if (!this.config.enabled || clientIdOfToken !== this.config.clientId) {
      this.logger.info('oauth app token revocation skipped', {
        ...fields,
        reason: this.config.enabled ? 'client_id_mismatch' : 'type_disabled',
      });
      return;
    }

    try {
      const { status } = await this.github.revokeOauthToken({
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        token,
      });

      if (status !== 204) {
        this.logger.warn('oauth app token revocation failed', { ...fields, githubStatus: status });
      }
    } catch (error) {
      this.logger.warn('oauth app token revocation failed', {
        ...fields,
        reason: error instanceof GithubClientError ? error.reason : 'unexpected_error',
      });
    }
  }
}
