import { Injectable } from '@nestjs/common';
import type { EnabledOauthAppConfig } from './oauth-app-config.js';
import { isOauthAppToken, OauthAppCodePayload } from './oauth-app-credential.js';
import { OauthAppRevocationService } from './oauth-app-revocation.service.js';
import { LoggerService } from '../../../core/logger.service.js';
import { isRateLimited, retryAfterSecondsFor } from '../../github-answer.js';
import { GithubClientError, GithubClientService, OauthCodeExchangeResponse } from '../../github-client.service.js';
import { CredentialInvalidError, GithubRateLimitedError, GithubUnavailableError } from '../../integration-errors.js';
import { Secret } from '../../secret.js';

// GitHub's exchange error for an unknown, expired or already used code.
const BAD_VERIFICATION_CODE = 'bad_verification_code';

/**
 * Exchanges an OAuth App callback `code` (with its PKCE verifier) for a user
 * access token and maps GitHub's answer to the spec's *Validate / create*
 * errors (see `docs/agents/modules/integrations/oauth-app.md#validate--create`).
 */
@Injectable()
export class OauthAppCodeExchangeService {
  private readonly github: GithubClientService;
  private readonly logger: LoggerService;
  private readonly revocation: OauthAppRevocationService;

  /**
   * @param {GithubClientService} github - The shared GitHub client.
   * @param {LoggerService} logger - Logs exchange misconfiguration with GitHub's error code only.
   * @param {OauthAppRevocationService} revocation - Revokes a token obtained but unusable.
   */
  constructor(github: GithubClientService, logger: LoggerService, revocation: OauthAppRevocationService) {
    this.github = github;
    this.logger = logger;
    this.revocation = revocation;
  }

  /**
   * Exchanges the code. `bad_verification_code` → `CredentialInvalidError`;
   * a rate limit → `GithubRateLimitedError`; any other error, status or a
   * missing `gho_` token → `GithubUnavailableError` (logged when GitHub
   * answered 200, since it means server misconfiguration).
   * @param {EnabledOauthAppConfig} config - The app config.
   * @param {OauthAppCodePayload} payload - The code and verifier.
   * @returns {Promise<Secret<string>>} The new token.
   */
  async exchange(config: EnabledOauthAppConfig, payload: OauthAppCodePayload): Promise<Secret<string>> {
    let answer: OauthCodeExchangeResponse;

    try {
      answer = await this.github.exchangeOauthCode({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        code: new Secret(payload.code),
        codeVerifier: new Secret(payload.codeVerifier),
        redirectUri: config.callbackUrl,
      });
    } catch (error) {
      throw error instanceof GithubClientError ? new GithubUnavailableError() : error;
    }

    if (answer.status === 200 && answer.accessToken !== null && isOauthAppToken(answer.accessToken.reveal())) {
      return answer.accessToken;
    }

    if (answer.accessToken !== null) {
      await this.revocation.revoke(answer.accessToken, config.clientId);
    }

    throw this.errorFor(answer);
  }

  /**
   * Maps a failed exchange answer to its domain error, logging misconfiguration.
   * @param {OauthCodeExchangeResponse} answer - The normalised answer.
   * @returns {Error} The error to throw.
   */
  private errorFor(answer: OauthCodeExchangeResponse): Error {
    if (isRateLimited(answer)) {
      return new GithubRateLimitedError(retryAfterSecondsFor(answer, Date.now()));
    }

    if (answer.status !== 200) {
      return new GithubUnavailableError();
    }

    if (answer.error === BAD_VERIFICATION_CODE) {
      return new CredentialInvalidError();
    }

    this.logger.error('oauth app code exchange failed', {
      type: 'oauth_app',
      githubError: answer.error ?? 'missing_access_token',
    });

    return new GithubUnavailableError();
  }
}
