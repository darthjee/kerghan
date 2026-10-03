import { Injectable } from '@nestjs/common';
import type { EnabledGithubAppConfig } from './github-app-config.js';
import { mintAppJwt } from './github-app-jwt.js';
import { hasRequiredPermissions } from './github-app-metadata.js';
import { GITHUB_APP_REASON_SUSPENDED, GITHUB_APP_REASON_UNINSTALLED } from './github-app-reasons.js';
import { LoggerService } from '../../../core/logger.service.js';
import { GithubStatusAndRateLimit, isRateLimited, retryAfterSecondsFor } from '../../github-answer.js';
import {
  GithubAppClientService,
  GithubAppInstallation,
  GithubAppInstallationResponse,
  GithubInstallationTokenResponse,
} from '../../github-app-client.service.js';
import { GithubClientError } from '../../github-client.service.js';
import { STATUS_REASON_INSUFFICIENT_PERMISSIONS } from '../../integration-enums.js';
import {
  GithubRateLimitedError,
  GithubUnavailableError,
  InstallationNotAccessibleError,
  InstallationSuspendedError,
  InsufficientPermissionsError,
} from '../../integration-errors.js';
import type { Secret } from '../../secret.js';
import type { TestOutcome } from '../integration-type-strategy.js';

// Message of the 422 for an installation without Issues and Metadata read.
export const GITHUB_APP_INSUFFICIENT_PERMISSIONS_MESSAGE =
  'This installation has not granted Issues and Metadata read access to the GitHub App';

/** The classified result of the app-JWT installation checks. */
export type InstallationCheck =
  | { kind: 'ok'; installation: GithubAppInstallation }
  | { kind: 'not_found' }
  | { kind: 'suspended' }
  | { kind: 'insufficient_permissions' }
  | { kind: 'rate_limited'; retryAfterSeconds?: number }
  | { kind: 'unavailable' };

/** What a test probe answers: the healthy installation, or the final test outcome. */
export type InstallationProbe =
  | { kind: 'ok'; installation: GithubAppInstallation }
  | Exclude<TestOutcome, { kind: 'active' } | { kind: 'expired' }>;

/**
 * The installation half of the GitHub App flow (spec *Validate / create*,
 * steps 3–4, and *Test connection*), authenticated with a fresh app JWT per
 * call: `GET /app/installations/{id}` (app id, suspension, permissions),
 * then `POST /app/installations/{id}/access_tokens` as proof the private key
 * can use it (the token is dropped). No user token is involved.
 */
@Injectable()
export class GithubAppInstallationService {
  private readonly appClient: GithubAppClientService;
  private readonly logger: LoggerService;

  /**
   * @param {GithubAppClientService} appClient - The GitHub App calls.
   * @param {LoggerService} logger - Logs app misconfiguration (a 401 on an app-JWT call), never JWT or key material.
   */
  constructor(appClient: GithubAppClientService, logger: LoggerService) {
    this.appClient = appClient;
    this.logger = logger;
  }

  /**
   * Checks an installation for callback and select, throwing the spec's domain errors.
   * @param {EnabledGithubAppConfig} config - The app config.
   * @param {number} installationId - The verified installation id.
   * @returns {Promise<GithubAppInstallation>} The healthy installation.
   */
  async verify(config: EnabledGithubAppConfig, installationId: number): Promise<GithubAppInstallation> {
    const check = await this.check(config, installationId);

    switch (check.kind) {
      case 'ok':
        return check.installation;
      case 'not_found':
        throw new InstallationNotAccessibleError();
      case 'suspended':
        throw new InstallationSuspendedError();
      case 'insufficient_permissions':
        throw new InsufficientPermissionsError(GITHUB_APP_INSUFFICIENT_PERMISSIONS_MESSAGE);
      case 'rate_limited':
        throw new GithubRateLimitedError(check.retryAfterSeconds);
      default:
        throw new GithubUnavailableError();
    }
  }

  /**
   * Probes a stored installation for test connection, mapping to the spec's outcomes.
   * @param {EnabledGithubAppConfig} config - The app config.
   * @param {number} installationId - The stored installation id.
   * @returns {Promise<InstallationProbe>} The healthy installation, or the test outcome.
   */
  async probe(config: EnabledGithubAppConfig, installationId: number): Promise<InstallationProbe> {
    const check = await this.check(config, installationId);

    switch (check.kind) {
      case 'ok':
        return check;
      case 'not_found':
        return { kind: 'invalid', reason: GITHUB_APP_REASON_UNINSTALLED };
      case 'suspended':
        return { kind: 'invalid', reason: GITHUB_APP_REASON_SUSPENDED };
      case 'insufficient_permissions':
        return { kind: 'invalid', reason: STATUS_REASON_INSUFFICIENT_PERMISSIONS };
      case 'rate_limited':
        return { kind: 'transient', error: 'rate_limited', retryAfterSeconds: check.retryAfterSeconds };
      default:
        return { kind: 'transient', error: 'unavailable' };
    }
  }

  /**
   * Runs both app-JWT calls and classifies the result.
   * @param {EnabledGithubAppConfig} config - The app config.
   * @param {number} installationId - The installation id.
   * @returns {Promise<InstallationCheck>} The classified result.
   */
  private async check(config: EnabledGithubAppConfig, installationId: number): Promise<InstallationCheck> {
    try {
      const lookup = await this.appClient.getAppInstallation(this.jwt(config), installationId);
      const looked = this.classifyLookup(lookup, config.appId);

      if (looked.kind !== 'ok') {
        return looked;
      }

      const minted = await this.appClient.createInstallationToken(this.jwt(config), installationId);

      return this.classifyMint(minted, looked);
    } catch (error) {
      if (error instanceof GithubClientError) {
        return { kind: 'unavailable' };
      }

      throw error;
    }
  }

  /**
   * Classifies `GET /app/installations/{id}`.
   * @param {GithubAppInstallationResponse} answer - The normalised answer.
   * @param {number} appId - The configured app id.
   * @returns {InstallationCheck} The classified result.
   */
  private classifyLookup(answer: GithubAppInstallationResponse, appId: number): InstallationCheck {
    const { installation } = answer;

    if (answer.status !== 200) {
      return this.classifyFailure(answer);
    }

    if (installation === null) {
      return { kind: 'unavailable' };
    }

    if (installation.appId !== appId) {
      return { kind: 'not_found' };
    }

    if (installation.suspended) {
      return { kind: 'suspended' };
    }

    return hasRequiredPermissions(installation.permissions)
      ? { kind: 'ok', installation }
      : { kind: 'insufficient_permissions' };
  }

  /**
   * Classifies `POST /app/installations/{id}/access_tokens` (201 proves the key works).
   * @param {GithubInstallationTokenResponse} answer - The normalised answer.
   * @param {InstallationCheck} looked - The successful lookup.
   * @returns {InstallationCheck} The classified result.
   */
  private classifyMint(answer: GithubInstallationTokenResponse, looked: InstallationCheck): InstallationCheck {
    if (answer.status === 201) {
      return looked;
    }

    if (answer.status === 403 && !isRateLimited(answer)) {
      return { kind: 'suspended' };
    }

    return this.classifyFailure(answer);
  }

  /**
   * Classifies a failed app-JWT call: 404, rate limit (before any 403), 401 misconfiguration, anything else.
   * @param {GithubStatusAndRateLimit} answer - The normalised answer.
   * @returns {InstallationCheck} The classified result.
   */
  private classifyFailure(answer: GithubStatusAndRateLimit): InstallationCheck {
    if (answer.status === 404) {
      return { kind: 'not_found' };
    }

    if (isRateLimited(answer)) {
      return { kind: 'rate_limited', retryAfterSeconds: retryAfterSecondsFor(answer, Date.now()) };
    }

    if (answer.status === 401) {
      this.logger.error('github app authentication failed: check the app id, client id and private key', {
        type: 'github_app',
        githubStatus: answer.status,
      });
    }

    return { kind: 'unavailable' };
  }

  /**
   * Mints a fresh app JWT for one call.
   * @param {EnabledGithubAppConfig} config - The app config.
   * @returns {Secret<string>} The JWT.
   */
  private jwt(config: EnabledGithubAppConfig): Secret<string> {
    return mintAppJwt(config.privateKey, config.clientId);
  }
}
