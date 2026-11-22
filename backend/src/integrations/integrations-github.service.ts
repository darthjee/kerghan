import { Injectable } from '@nestjs/common';
import { GithubAuthenticatedRunner } from './github-authenticated-runner.js';
import { ISSUE_READ_PERMISSIONS, REPO_LISTING_PERMISSIONS } from './github-installation-permissions.js';
import { GithubIssueClientService } from './github-issue-client.service.js';
import type { GithubIssueRepo, IssueProbeResult, IssueResult } from './github-issue-results.js';
import { GithubRepoClientService, type RepoCall } from './github-repo-client.service.js';
import type { IntegrationRef, RepoPageResult, RepoResult } from './github-repo-results.js';
import { GithubUnauthenticatedBudget, type UnauthenticatedPurpose } from './github-unauthenticated-budget.js';
import { integrationRef as toRef } from './integration-response.js';
import { IntegrationStoreService } from './integration-store.service.js';
import type { Secret } from './secret.js';
import { Clock } from '../core/clock.js';

/** A repo call made with a credential, or with none (`null`). */
type Call<T> = (token: Secret<string> | null) => Promise<RepoCall<T>>;

/** The repo result union an operation answers. */
type AnyRepoResult = RepoPageResult | RepoResult;

/**
 * The Integrations module's only cross-module surface for GitHub reads (see
 * `docs/agents/modules/integrations/github-service.md#exported-service`): fixed,
 * `GET`-only operations with typed, normalised results. Credentials,
 * minted installation tokens, `secret_iv` values and GitHub bodies never
 * leave the module; logs carry safe fields only (integration id, operation,
 * HTTP status, result kind).
 *
 * Every authenticated call loads its integration with `WHERE id = ? AND
 * user_id = ?`; a missing, foreign or non-usable one answers
 * `integration_unusable` without a GitHub call. `integrationId: null` is an
 * unauthenticated call (repo operations only), gated by the process-wide
 * budget tracker. The one write, `updateIssue`, lives on
 * `IntegrationsGithubIssueWriter`.
 */
@Injectable()
export class IntegrationsGithubService {
  /**
   * @param {IntegrationStoreService} store - Owner-scoped persistence.
   * @param {GithubAuthenticatedRunner} runner - The shared authenticated path.
   * @param {GithubRepoClientService} client - The repo HTTP client.
   * @param {GithubIssueClientService} issueClient - The issue HTTP client.
   * @param {GithubUnauthenticatedBudget} budget - The unauthenticated budget tracker.
   * @param {Clock} clock - The time source.
   */
  constructor(
    private readonly store: IntegrationStoreService,
    private readonly runner: GithubAuthenticatedRunner,
    private readonly client: GithubRepoClientService,
    private readonly issueClient: GithubIssueClientService,
    private readonly budget: GithubUnauthenticatedBudget,
    private readonly clock: Clock,
  ) {}

  /**
   * Lists the user's usable integrations (reported `active`, type enabled), oldest first.
   * @param {number} userId - The owner's id.
   * @returns {Promise<IntegrationRef[]>} The usable integrations.
   */
  async listUsableIntegrations(userId: number): Promise<IntegrationRef[]> {
    const now = this.clock.now();

    return (await this.store.listOwnedOldestFirst(userId)).filter((row) => this.runner.unusableReason(row, now) === null).map(toRef);
  }

  /**
   * Lists every integration of the user, usable or not, oldest first (same fields as above).
   * @param {number} userId - The owner's id.
   * @returns {Promise<IntegrationRef[]>} The user's integrations.
   */
  async listIntegrations(userId: number): Promise<IntegrationRef[]> {
    return (await this.store.listOwnedOldestFirst(userId)).map(toRef);
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
    return this.runner.run<RepoPageResult>(userId, integrationId, 'list_repositories', REPO_LISTING_PERMISSIONS, (token, type) => (
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
   * One issue (`GET /repos/{owner}/{name}/issues/{number}`), with an ETag for a conditional read.
   * A rename redirect is followed once inside the adapter and reported as `renamedTo`.
   * @param {number} userId - The owner's id.
   * @param {number} integrationId - The internal `integrations.id`.
   * @param {GithubIssueRepo} repo - The repository row's id and names.
   * @param {number} number - The issue number.
   * @param {string | null} [etag] - The stored ETag, sent as `If-None-Match`.
   * @returns {Promise<IssueResult>} The typed issue.
   */
  getIssue(
    userId: number,
    integrationId: number,
    repo: GithubIssueRepo,
    number: number,
    etag?: string | null,
  ): Promise<IssueResult> {
    return this.runner.run<IssueResult>(userId, integrationId, 'get_issue', ISSUE_READ_PERMISSIONS, (token) =>
      this.issueClient.getIssue(token, repo, number, etag));
  }

  /**
   * Whether the integration can read a repository's issues (`GET /repos/{owner}/{name}/issues?per_page=1`).
   * @param {number} userId - The owner's id.
   * @param {number} integrationId - The internal `integrations.id`.
   * @param {GithubIssueRepo} repo - The repository row's id and names.
   * @returns {Promise<IssueProbeResult>} The typed probe.
   */
  probeIssues(userId: number, integrationId: number, repo: GithubIssueRepo): Promise<IssueProbeResult> {
    return this.runner.run<IssueProbeResult>(userId, integrationId, 'probe_issues', ISSUE_READ_PERMISSIONS, (token) =>
      this.issueClient.probeIssues(token, repo));
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
      : this.runner.run<T>(userId, integrationId, operation, REPO_LISTING_PERMISSIONS, (token) => call(token));
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

    this.runner.log(null, operation, answer.status, answer.result);

    return answer.result;
  }
}
