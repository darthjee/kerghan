import { Injectable } from '@nestjs/common';
import { Clock } from '../core/clock.js';
import { LoggerService } from '../core/logger.service.js';
import type { Integration } from './entities/integration.entity.js';
import { GithubAppRepoCaller } from './github-app-repo-caller.js';
import { GithubRepoClientService, type RepoCall } from './github-repo-client.service.js';
import type {
  IntegrationRef,
  IntegrationUnusableReason,
  RepoFailure,
  RepoPageResult,
  RepoResult,
} from './github-repo-results.js';
import { GithubUnauthenticatedBudget, type UnauthenticatedPurpose } from './github-unauthenticated-budget.js';
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

/** A repo call made with a credential, or with none (`null`). */
type Call<T> = (token: Secret<string> | null) => Promise<RepoCall<T>>;

/** The repo result union an operation answers. */
type AnyRepoResult = RepoPageResult | RepoResult;

// The bad-credentials reason a `401` sets, per token type (`github_app` never invalidates on a call's `401`).
const BAD_CREDENTIALS_REASONS: Readonly<Record<string, string>> = {
  pat: PAT_REASON_BAD_CREDENTIALS,
  oauth_app: OAUTH_APP_REASON_REVOKED,
};

/**
 * The Integrations module's only cross-module surface for GitHub (see
 * `docs/agents/specs/repos/integrations.md#exported-service`): fixed,
 * `GET`-only repo operations with typed, normalised results. Credentials,
 * minted installation tokens, `secret_iv` values and GitHub bodies never
 * leave the module; logs carry safe fields only (integration id, operation,
 * HTTP status, result kind).
 *
 * Every authenticated call loads its integration with `WHERE id = ? AND
 * user_id = ?`; a missing, foreign or non-usable one answers
 * `integration_unusable` without a GitHub call. `integrationId: null` is an
 * unauthenticated call, gated by the process-wide budget tracker.
 */
@Injectable()
export class IntegrationsGithubService {
  /**
   * @param {IntegrationStoreService} store - Owner-scoped persistence and the status compare-and-set.
   * @param {IntegrationsEncryptionService} encryption - Decrypts the stored credential.
   * @param {IntegrationTypeRegistry} registry - Resolves type strategies (and whether a type is enabled).
   * @param {GithubRepoClientService} client - The repo HTTP client.
   * @param {GithubAppRepoCaller} githubApp - Runs `github_app` calls with installation tokens.
   * @param {GithubUnauthenticatedBudget} budget - The unauthenticated budget tracker.
   * @param {Clock} clock - The time source.
   * @param {LoggerService} logger - Safe-field logs only.
   */
  constructor(
    private readonly store: IntegrationStoreService,
    private readonly encryption: IntegrationsEncryptionService,
    private readonly registry: IntegrationTypeRegistry,
    private readonly client: GithubRepoClientService,
    private readonly githubApp: GithubAppRepoCaller,
    private readonly budget: GithubUnauthenticatedBudget,
    private readonly clock: Clock,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Lists the user's usable integrations (reported `active`, type enabled), oldest first.
   * @param {number} userId - The owner's id.
   * @returns {Promise<IntegrationRef[]>} The usable integrations.
   */
  async listUsableIntegrations(userId: number): Promise<IntegrationRef[]> {
    const rows = await this.store.listOwnedOldestFirst(userId);
    const now = this.clock.now();

    return rows
      .filter((row) => this.#unusableReason(row, now) === null)
      .map((row) => ({ id: row.id, uuid: row.uuid, label: row.label, type: row.type as IntegrationType }));
  }

  /**
   * One page of an integration's repositories: `GET /user/repos` for `pat` /
   * `oauth_app`, `GET /installation/repositories` for `github_app`.
   * @param {number} userId - The owner's id.
   * @param {number} integrationId - The internal `integrations.id`.
   * @param {number} page - The 1-based page number.
   * @param {string | null} [etag] - The stored ETag, sent as `If-None-Match`.
   * @returns {Promise<RepoPageResult>} The typed page.
   */
  listRepositories(userId: number, integrationId: number, page: number, etag?: string | null): Promise<RepoPageResult> {
    return this.#authenticated<RepoPageResult>(userId, integrationId, 'list_repositories', (token, type) => (
      type === 'github_app'
        ? this.client.listInstallationRepos(token, page, etag)
        : this.client.listUserRepos(token, page, etag)
    ));
  }

  /**
   * One page of a handle's own repositories (`GET /users/{handle}/repos?type=owner`).
   * @param {number} userId - The owner's id.
   * @param {number | null} integrationId - The integration to authenticate with, or `null`.
   * @param {string} handle - The GitHub handle.
   * @param {number} page - The 1-based page number.
   * @param {string | null} [etag] - The stored ETag, sent as `If-None-Match`.
   * @returns {Promise<RepoPageResult>} The typed page.
   */
  listHandleRepositories(
    userId: number,
    integrationId: number | null,
    handle: string,
    page: number,
    etag?: string | null,
  ): Promise<RepoPageResult> {
    return this.#route<RepoPageResult>(userId, integrationId, 'list_handle_repositories', 'sync', (token) =>
      this.client.listHandleRepos(token, handle, page, etag));
  }

  /**
   * One repository by id (`GET /repositories/{githubId}`), for Add's re-check.
   * @param {number} userId - The owner's id.
   * @param {number | null} integrationId - The integration to authenticate with, or `null`.
   * @param {number} githubId - The repository id.
   * @returns {Promise<RepoResult>} The typed repo.
   */
  getRepository(userId: number, integrationId: number | null, githubId: number): Promise<RepoResult> {
    return this.#route<RepoResult>(userId, integrationId, 'get_repository', 'add', (token) =>
      this.client.getRepositoryById(token, githubId));
  }

  /**
   * Sends a call authenticated, or unauthenticated when `integrationId` is `null`.
   * @param {number} userId - The owner's id.
   * @param {number | null} integrationId - The integration, or `null`.
   * @param {string} operation - The operation name, for logs.
   * @param {UnauthenticatedPurpose} purpose - The budget threshold for an unauthenticated call.
   * @param {Call<T>} call - The repo call.
   * @returns {Promise<T>} The typed result.
   */
  #route<T extends AnyRepoResult>(
    userId: number,
    integrationId: number | null,
    operation: string,
    purpose: UnauthenticatedPurpose,
    call: Call<T>,
  ): Promise<T> {
    return integrationId === null
      ? this.#unauthenticated(operation, purpose, call)
      : this.#authenticated<T>(userId, integrationId, operation, (token) => call(token));
  }

  /**
   * An unauthenticated call: refused under the purpose's threshold, else sent
   * without `Authorization`; its rate-limit headers are recorded.
   * @param {string} operation - The operation name, for logs.
   * @param {UnauthenticatedPurpose} purpose - `sync` or `add`.
   * @param {Call<T>} call - The repo call.
   * @returns {Promise<T>} The typed result.
   */
  async #unauthenticated<T extends AnyRepoResult>(operation: string, purpose: UnauthenticatedPurpose, call: Call<T>): Promise<T> {
    const grant = this.budget.tryAcquire(purpose);

    if (!grant.ok) {
      return { kind: 'rate_limited', resetAt: grant.resetAt } as T;
    }

    const answer = await call(null);

    if (answer.rateLimit !== null) {
      this.budget.record(answer.rateLimit);
    }

    this.#log(null, operation, answer.status, answer.result);

    return answer.result;
  }

  /**
   * An authenticated call: load (owner-scoped) → usability → decrypt → call → `401` handling.
   * @param {number} userId - The owner's id.
   * @param {number} integrationId - The internal `integrations.id`.
   * @param {string} operation - The operation name, for logs.
   * @param {Function} call - The repo call, given the token and the integration type.
   * @returns {Promise<T>} The typed result.
   */
  async #authenticated<T extends AnyRepoResult>(
    userId: number,
    integrationId: number,
    operation: string,
    call: (token: Secret<string>, type: IntegrationType) => Promise<RepoCall<T>>,
  ): Promise<T> {
    const row = await this.store.findOwnedById(userId, integrationId);
    const unusable = row === null ? 'missing' : this.#unusableReason(row, this.clock.now());

    if (row === null || unusable !== null) {
      return unusableResult(unusable ?? 'missing') as T;
    }

    const secret = decryptRow(this.encryption, this.registry.get(row.type), row);
    const ivUsed = row.secretIv;

    if (secret === null) {
      await this.store.setStatusIfCredential(row, ivUsed, 'undecryptable', null);
      this.#log(row.id, operation, null, unusableResult('status'));
      return unusableResult('status') as T;
    }

    const type = row.type as IntegrationType;

    if (type === 'github_app') {
      const target = { row, installationId: installationIdOf(secret), ivUsed, operation };
      const answer = await this.githubApp.call(target, (token) => call(token, type));

      this.#log(row.id, operation, answer.status, answer.result);
      return answer.result as T;
    }

    return this.#withToken(row, ivUsed, operation, (token) => call(token, type), secret);
  }

  /**
   * A `pat` / `oauth_app` call; a `401` sets the integration `invalid` (compare-and-set on `secret_iv`).
   * @param {Integration} row - The loaded row.
   * @param {Buffer} ivUsed - The `secret_iv` of the decrypted credential.
   * @param {string} operation - The operation name, for logs.
   * @param {TokenCall} call - The repo call.
   * @param {Secret} secret - The decrypted `{ token }` payload.
   * @returns {Promise<T>} The typed result.
   */
  async #withToken<T extends AnyRepoResult>(
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

    this.#log(row.id, operation, answer.status, answer.result);

    return answer.result;
  }

  /**
   * Why an integration is not usable, or `null` when it is.
   * @param {Integration} row - The row.
   * @param {Date} now - The current time (for `expired`).
   * @returns {IntegrationUnusableReason | null} `type_disabled`, `status`, or `null`.
   */
  #unusableReason(row: Integration, now: Date): IntegrationUnusableReason | null {
    const strategy = this.registry.find(row.type);

    if (!(INTEGRATION_TYPES as readonly string[]).includes(row.type) || strategy === undefined
      || !(strategy.isEnabled?.() ?? true)) {
      return 'type_disabled';
    }

    return reportedStatus(row, this.encryption.isDecryptableKeyId(row.secretKeyId), now) === 'active' ? null : 'status';
  }

  /**
   * Logs a call's outcome with safe fields only (never a body, token, IV or URL).
   * @param {number | null} integrationId - The integration, or `null` when unauthenticated.
   * @param {string} operation - The operation name.
   * @param {number | null} status - GitHub's HTTP status, when there was an answer.
   * @param {AnyRepoResult} result - The typed result.
   * @returns {void}
   */
  #log(integrationId: number | null, operation: string, status: number | null, result: AnyRepoResult): void {
    if (result.kind === 'ok' || result.kind === 'not_modified' || result.kind === 'not_found') {
      return;
    }

    this.logger.warn('github repo call failed', { integrationId, operation, status, result: result.kind });
  }
}

/**
 * @param {IntegrationUnusableReason} reason - Why the integration was not called.
 * @returns {RepoFailure} `integration_unusable` with that reason.
 */
function unusableResult(reason: IntegrationUnusableReason): RepoFailure {
  return { kind: 'integration_unusable', reason };
}
