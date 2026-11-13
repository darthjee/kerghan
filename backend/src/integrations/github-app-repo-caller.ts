import { Inject, Injectable } from '@nestjs/common';
import { Clock } from '../core/clock.js';
import { LoggerService } from '../core/logger.service.js';
import type { Integration } from './entities/integration.entity.js';
import { GithubInstallationTokenCache, type InstallationTokenAnswer, type InstallationTokenKey } from './github-installation-token-cache.js';
import { GithubRepoClientService, type RepoCall } from './github-repo-client.service.js';
import type { InstallationTokenMint } from './github-repo-response.js';
import type { RepoFailure, RepoPageResult, RepoResult } from './github-repo-results.js';
import { IntegrationStoreService } from './integration-store.service.js';
import type { Secret } from './secret.js';
import { GITHUB_APP_CONFIG, type GithubAppConfig } from './types/github-app/github-app-config.js';
import { mintAppJwt } from './types/github-app/github-app-jwt.js';
import { GITHUB_APP_REASON_SUSPENDED, GITHUB_APP_REASON_UNINSTALLED } from './types/github-app/github-app-reasons.js';

/** A mint failure, shaped like a repo call's outcome (no HTTP answer of the call itself). */
export interface MintFailureCall {
  result: RepoFailure;
  status: number | null;
}

/** A repo call made with a token (an installation token here). */
export type TokenCall<T> = (token: Secret<string>) => Promise<RepoCall<T>>;

/** What `call` needs from the row: the integration, its installation and the credential IV used. */
export interface GithubAppCallTarget {
  row: Pick<Integration, 'id' | 'userId'>;
  installationId: number;
  ivUsed: Buffer;
  operation: string;
}

/**
 * Makes a repo call for a `github_app` integration with an installation
 * token from the cache (see
 * `docs/agents/specs/repos/integrations.md#github-app-installation-tokens`).
 * Internal to the Integrations module.
 *
 * - A `401` with a cached token evicts it, mints once and retries once; a
 *   `401` with a freshly minted token answers `unavailable` (`unexpected`),
 *   status unchanged: a `github_app` call's `401` never invalidates.
 * - A mint `404` / `403` sets the integration `invalid` (`uninstalled` /
 *   `suspended`) as a `secret_iv` compare-and-set; a mint `401` (app JWT
 *   rejected) is a server misconfiguration, logged at error level.
 */
@Injectable()
export class GithubAppRepoCaller {
  /**
   * @param {GithubRepoClientService} client - The repo client (mints tokens).
   * @param {GithubInstallationTokenCache} tokens - The installation-token cache.
   * @param {IntegrationStoreService} store - The status compare-and-set.
   * @param {Clock} clock - The time source, for the app JWT.
   * @param {LoggerService} logger - Safe-field logs only.
   * @param {GithubAppConfig} config - The GitHub App server config.
   */
  constructor(
    private readonly client: GithubRepoClientService,
    private readonly tokens: GithubInstallationTokenCache,
    private readonly store: IntegrationStoreService,
    private readonly clock: Clock,
    private readonly logger: LoggerService,
    @Inject(GITHUB_APP_CONFIG) private readonly config: GithubAppConfig,
  ) {}

  /**
   * Runs `call` with an installation token, applying the retry and mint rules.
   * @param {GithubAppCallTarget} target - The integration, installation, IV and operation name.
   * @param {TokenCall<T>} call - The repo call.
   * @returns {Promise<RepoCall<T> | MintFailureCall>} The call's outcome, or the mint failure.
   */
  async call<T extends RepoPageResult | RepoResult>(
    target: GithubAppCallTarget,
    call: TokenCall<T>,
  ): Promise<RepoCall<T> | MintFailureCall> {
    const key: InstallationTokenKey = {
      integrationId: target.row.id,
      userId: target.row.userId,
      installationId: target.installationId,
      ivUsed: target.ivUsed,
    };
    const first = await this.#token(key, target);

    if (first.kind !== 'token') {
      return { result: first, status: null };
    }

    const answer = await call(first.token);

    if (answer.result.kind !== 'invalid_credentials') {
      return answer;
    }

    if (first.fresh) {
      return this.#freshTokenRejected(target, answer.status);
    }

    this.tokens.evict(target.row.id);

    return this.#retry(key, target, call);
  }

  /**
   * Mints once more and retries the call once after a cached token's `401`.
   * @param {InstallationTokenKey} key - The cache key.
   * @param {GithubAppCallTarget} target - The call target.
   * @param {TokenCall<T>} call - The repo call.
   * @returns {Promise<RepoCall<T> | MintFailureCall>} The retry's outcome.
   */
  async #retry<T extends RepoPageResult | RepoResult>(
    key: InstallationTokenKey,
    target: GithubAppCallTarget,
    call: TokenCall<T>,
  ): Promise<RepoCall<T> | MintFailureCall> {
    const second = await this.#token(key, target);

    if (second.kind !== 'token') {
      return { result: second, status: null };
    }

    const answer = await call(second.token);

    return answer.result.kind === 'invalid_credentials' ? this.#freshTokenRejected(target, answer.status) : answer;
  }

  /**
   * Acquires a token, mapping a mint failure to a repo failure.
   * @param {InstallationTokenKey} key - The cache key.
   * @param {GithubAppCallTarget} target - The call target.
   * @returns {Promise<{ kind: 'token', token: Secret<string>, fresh: boolean } | RepoFailure>} The token or the failure.
   */
  async #token(
    key: InstallationTokenKey,
    target: GithubAppCallTarget,
  ): Promise<Extract<InstallationTokenAnswer, { kind: 'token' }> | RepoFailure> {
    const answer = await this.tokens.acquire(key, () => this.#mint(key.installationId));

    switch (answer.kind) {
      case 'token':
      case 'rate_limited':
      case 'unavailable':
        return answer;
      case 'jwt_rejected':
        this.logger.error('github app jwt rejected on installation token mint', {
          integrationId: target.row.id,
          operation: target.operation,
          status: 401,
          result: 'unavailable',
        });
        return { kind: 'unavailable', reason: 'unexpected' };
      default:
        return this.#invalidate(target, answer.kind === 'uninstalled' ? GITHUB_APP_REASON_UNINSTALLED : GITHUB_APP_REASON_SUSPENDED);
    }
  }

  /**
   * Mints an installation token with a fresh app JWT.
   * @param {number} installationId - The installation id.
   * @returns {Promise<InstallationTokenMint>} The mint's outcome.
   */
  #mint(installationId: number): Promise<InstallationTokenMint> {
    if (!this.config.enabled) {
      return Promise.resolve({ kind: 'unavailable', reason: 'unexpected' });
    }

    const jwt = mintAppJwt(this.config.privateKey, this.config.clientId, this.clock.now().getTime());

    return this.client.mintInstallationToken(jwt, installationId);
  }

  /**
   * Sets the integration `invalid` after a mint `404` / `403`, if its credential is unchanged.
   * @param {GithubAppCallTarget} target - The call target.
   * @param {string} reason - `uninstalled` or `suspended`.
   * @returns {Promise<RepoFailure>} `invalid_credentials`.
   */
  async #invalidate(target: GithubAppCallTarget, reason: string): Promise<RepoFailure> {
    const changed = await this.store.setStatusIfCredential(target.row, target.ivUsed, 'invalid', reason);

    this.logger.warn('github app installation token mint refused', {
      integrationId: target.row.id,
      operation: target.operation,
      status: reason === GITHUB_APP_REASON_UNINSTALLED ? 404 : 403,
      result: 'invalid_credentials',
      statusChanged: changed,
    });

    return { kind: 'invalid_credentials' };
  }

  /**
   * A freshly minted token was refused: the installation exists, so the
   * status is unchanged and the call answers `unavailable` (`unexpected`).
   * @param {GithubAppCallTarget} target - The call target.
   * @param {number | null} status - GitHub's status.
   * @returns {MintFailureCall} The failure.
   */
  #freshTokenRejected(target: GithubAppCallTarget, status: number | null): MintFailureCall {
    this.logger.warn('github app fresh installation token rejected', {
      integrationId: target.row.id,
      operation: target.operation,
      status,
      result: 'unavailable',
    });

    return { result: { kind: 'unavailable', reason: 'unexpected' }, status };
  }
}
