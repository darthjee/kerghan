import { Injectable } from '@nestjs/common';
import { Clock } from '../core/clock.js';
import { LoggerService } from '../core/logger.service.js';
import type { Integration } from './entities/integration.entity.js';
import { type GithubAppCallResult, GithubAppRepoCaller } from './github-app-repo-caller.js';
import type { InstallationPermissionSet, RepoCall } from './github-repo-client.service.js';
import type { IntegrationUnusableReason, RepoFailure } from './github-repo-results.js';
import { decryptRow } from './integration-connection-test.service.js';
import { INTEGRATION_TYPES, type IntegrationType } from './integration-enums.js';
import { reportedStatus } from './integration-response.js';
import { IntegrationStoreService } from './integration-store.service.js';
import { IntegrationsEncryptionService } from './integrations-encryption.service.js';
import { Secret } from './secret.js';
import { installationIdOf } from './types/github-app/github-app-credential.js';
import { IntegrationTypeRegistry } from './types/integration-type-registry.js';
import { OAUTH_APP_REASON_REVOKED } from './types/oauth-app/oauth-app.strategy.js';
import { PAT_REASON_BAD_CREDENTIALS } from './types/pat/pat.strategy.js';

// The bad-credentials reason a `401` sets, per token type (`github_app` never invalidates on a call's `401`).
const BAD_CREDENTIALS_REASONS: Readonly<Record<string, string>> = {
  pat: PAT_REASON_BAD_CREDENTIALS,
  oauth_app: OAUTH_APP_REASON_REVOKED,
};

/**
 * The authenticated path shared by `IntegrationsGithubService` and
 * `IntegrationsGithubIssueWriter`: an owner-scoped load, the usability check,
 * decryption, `github_app` through the installation-token caller, the `401`
 * handling and safe logs. Internal to the Integrations module (never exported).
 *
 * The integration is loaded with `WHERE id = ? AND user_id = ?`; a missing,
 * foreign or non-usable one answers `integration_unusable` without a GitHub
 * call. Logs carry safe fields only (integration id, operation, HTTP status,
 * result kind): never a body, token, IV or URL.
 */
@Injectable()
export class GithubAuthenticatedRunner {
  /**
   * @param {IntegrationStoreService} store - Owner-scoped persistence and the status compare-and-set.
   * @param {IntegrationsEncryptionService} encryption - Decrypts the stored credential.
   * @param {IntegrationTypeRegistry} registry - Resolves type strategies (and whether a type is enabled).
   * @param {GithubAppRepoCaller} githubApp - Runs `github_app` calls with installation tokens.
   * @param {Clock} clock - The time source.
   * @param {LoggerService} logger - Safe-field logs only.
   */
  constructor(
    private readonly store: IntegrationStoreService,
    private readonly encryption: IntegrationsEncryptionService,
    private readonly registry: IntegrationTypeRegistry,
    private readonly githubApp: GithubAppRepoCaller,
    private readonly clock: Clock,
    private readonly logger: LoggerService,
  ) {}

  /**
   * An authenticated call: load (owner-scoped) → usability → decrypt → call → `401` handling.
   * @param {number} userId - The owner's id.
   * @param {number} integrationId - The internal `integrations.id`.
   * @param {string} operation - The operation name, for logs.
   * @param {InstallationPermissionSet} permissions - The permissions a `github_app` token is minted with.
   * @param {Function} call - The call, given the token and the integration type.
   * @returns {Promise<T>} The typed result.
   */
  async run<T extends GithubAppCallResult>(
    userId: number,
    integrationId: number,
    operation: string,
    permissions: InstallationPermissionSet,
    call: (token: Secret<string>, type: IntegrationType) => Promise<RepoCall<T>>,
  ): Promise<T> {
    const row = await this.store.findOwnedById(userId, integrationId);
    const unusable = row === null ? 'missing' : this.unusableReason(row, this.clock.now());

    if (row === null || unusable !== null) {
      return unusableResult(unusable ?? 'missing') as T;
    }

    const secret = decryptRow(this.encryption, this.registry.get(row.type), row);
    const ivUsed = row.secretIv;

    if (secret === null) {
      await this.store.setStatusIfCredential(row, ivUsed, 'undecryptable', null);
      this.log(row.id, operation, null, unusableResult('status'));
      return unusableResult('status') as T;
    }

    const type = row.type as IntegrationType;

    if (type === 'github_app') {
      const target = { row, installationId: installationIdOf(secret), ivUsed, operation, permissions };
      const answer = await this.githubApp.call(target, (token) => call(token, type));

      this.log(row.id, operation, answer.status, answer.result);
      return answer.result as T;
    }

    return this.#withToken(row, ivUsed, operation, (token) => call(token, type), secret);
  }

  /**
   * Why an integration is not usable, or `null` when it is.
   * @param {Integration} row - The row.
   * @param {Date} now - The current time (for `expired`).
   * @returns {IntegrationUnusableReason | null} `type_disabled`, `status`, or `null`.
   */
  unusableReason(row: Integration, now: Date): IntegrationUnusableReason | null {
    const strategy = this.registry.find(row.type);

    if (!(INTEGRATION_TYPES as readonly string[]).includes(row.type) || strategy === undefined
      || !(strategy.isEnabled?.() ?? true)) {
      return 'type_disabled';
    }

    return reportedStatus(row, this.encryption.isDecryptableKeyId(row.secretKeyId), now) === 'active' ? null : 'status';
  }

  /**
   * Logs a call's outcome with safe fields only (never a body, token, IV or URL).
   * `ok`, `not_modified` and `not_found` are quiet; every other kind is logged.
   * @param {number | null} integrationId - The integration, or `null` when unauthenticated.
   * @param {string} operation - The operation name.
   * @param {number | null} status - GitHub's HTTP status, when there was an answer.
   * @param {GithubAppCallResult} result - The typed result.
   * @returns {void}
   */
  log(integrationId: number | null, operation: string, status: number | null, result: GithubAppCallResult): void {
    if (result.kind === 'ok' || result.kind === 'not_modified' || result.kind === 'not_found') {
      return;
    }

    this.logger.warn('github repo call failed', { integrationId, operation, status, result: result.kind });
  }

  /**
   * A `pat` / `oauth_app` call; a `401` sets the integration `invalid` (compare-and-set on `secret_iv`).
   * @param {Integration} row - The loaded row.
   * @param {Buffer} ivUsed - The `secret_iv` of the decrypted credential.
   * @param {string} operation - The operation name, for logs.
   * @param {Function} call - The call.
   * @param {Secret} secret - The decrypted `{ token }` payload.
   * @returns {Promise<T>} The typed result.
   */
  async #withToken<T extends GithubAppCallResult>(
    row: Integration,
    ivUsed: Buffer,
    operation: string,
    call: (token: Secret<string>) => Promise<RepoCall<T>>,
    secret: Secret,
  ): Promise<T> {
    const answer = await call(new Secret((secret.reveal() as { token: string }).token));

    if (answer.result.kind === 'invalid_credentials') {
      await this.store.setStatusIfCredential(row, ivUsed, 'invalid', BAD_CREDENTIALS_REASONS[row.type] ?? null);
    }

    this.log(row.id, operation, answer.status, answer.result);

    return answer.result;
  }
}

/**
 * @param {IntegrationUnusableReason} reason - Why the integration was not called.
 * @returns {RepoFailure} `integration_unusable` with that reason.
 */
function unusableResult(reason: IntegrationUnusableReason): RepoFailure {
  return { kind: 'integration_unusable', reason };
}
