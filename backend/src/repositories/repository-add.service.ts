import { HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { addRateLimited, repositoryNotFound, repositorySourceUnusable } from './repositories-http-errors.js';
import { RepositoriesService } from './repositories.service.js';
import { RepositoryAddRateLimiter } from './repository-add-rate-limiter.js';
import { Clock } from '../core/clock.js';
import { githubRateLimited, githubUnavailable } from '../core/github-http-errors.js';
import {
  type AddWalkResult,
  IntegrationsGithubService,
  walkAddCandidates,
} from '../integrations/integrations-github.public.js';
import type { FoundRepository, ListedRepository, RepoRef } from './types/repositories-api.types.js';

/** A walk that ended without a repo: every outcome but `ok`. */
type FailedWalk = Exclude<AddWalkResult, { kind: 'ok' }>;

/**
 * Runs Add (`docs/agents/backend/routes/repositories.md#add`) after DTO validation:
 * rate limit → handle reconciliation → lookup among the caller's own rows →
 * already-added shortcut → GitHub re-check (candidate walk, built from the
 * stored row's `githubId`, never from the request) → conditional write. It
 * returns the listing row and throws the module's HTTP errors; it never logs
 * or echoes anything GitHub answered.
 */
@Injectable()
export class RepositoryAddService {
  /**
   * @param {RepositoriesService} repositories - The data layer (reconcile, lookup, write).
   * @param {IntegrationsGithubService} github - The usable integrations and the re-check call.
   * @param {RepositoryAddRateLimiter} rateLimiter - The per-user Add window.
   * @param {Clock} clock - Turns a GitHub reset time into a delay.
   */
  constructor(
    private readonly repositories: RepositoriesService,
    private readonly github: IntegrationsGithubService,
    private readonly rateLimiter: RepositoryAddRateLimiter,
    private readonly clock: Clock,
  ) {}

  /**
   * Marks one of the caller's repositories as added.
   * @param {number} userId - The session's user.
   * @param {RepoRef} ref - The validated repo ref.
   * @returns {Promise<ListedRepository>} The added row (or the already-added one, unchanged).
   * @throws {HttpException} `429`, `401`, `404`, `409`, `502` or `503` as in `docs/agents/backend/routes/repositories.md#add`.
   */
  async add(userId: number, ref: RepoRef): Promise<ListedRepository> {
    this.#consume(userId);

    if ((await this.repositories.reconcileForRequest(userId)).kind === 'no_user') {
      throw new UnauthorizedException('Invalid session');
    }

    const found = await this.repositories.findByRef(userId, ref);

    if (found === null) throw repositoryNotFound();
    if (found.repository.addedAt !== null) return found.repository;

    return this.#recheckAndMark(userId, found);
  }

  /**
   * Counts the attempt, refusing it over the per-user limit.
   * @param {number} userId - The caller.
   * @returns {void}
   */
  #consume(userId: number): void {
    const decision = this.rateLimiter.consume(userId);

    if (!decision.allowed) throw addRateLimited(Math.ceil(decision.retryAfterMs / 1000));
  }

  /**
   * Re-checks the stored repo with GitHub, then writes the mark.
   * @param {number} userId - The caller.
   * @param {FoundRepository} found - The caller's not-added row.
   * @returns {Promise<ListedRepository>} The added row.
   */
  async #recheckAndMark(userId: number, found: FoundRepository): Promise<ListedRepository> {
    const { githubId } = found.repository;
    const walk = await walkAddCandidates(
      {
        userId,
        githubId,
        holderIntegrationIds: found.holderIntegrationIds,
        handleSeesRepo: found.handleSeesRepo,
        usable: await this.github.listUsableIntegrations(userId),
      },
      (u, i, g) => this.github.getRepository(u, i, g),
    );

    if (walk.kind !== 'ok') throw this.#walkError(walk);

    const { owner, name, private: isPrivate } = walk.repo;
    const outcome = await this.repositories.markAdded(userId, { githubId }, walk.linkIntegrationId, {
      owner,
      name,
      private: isPrivate,
    });

    if (outcome.kind === 'gone') throw repositoryNotFound();

    return outcome.repository;
  }

  /**
   * Maps a walk that found nothing to its HTTP answer.
   * @param {FailedWalk} walk - The walk's outcome.
   * @returns {HttpException} The exception to throw.
   */
  #walkError(walk: FailedWalk): HttpException {
    switch (walk.kind) {
      case 'no_candidate':
        return repositorySourceUnusable();
      case 'denied':
        return repositoryNotFound();
      case 'rate_limited':
        return githubRateLimited(this.#secondsUntil(walk.resetAt));
      default:
        return githubUnavailable();
    }
  }

  /**
   * @param {Date | null} resetAt - GitHub's reset time, when known.
   * @returns {number | undefined} Whole seconds until then (rounded up, never negative), or `undefined`.
   */
  #secondsUntil(resetAt: Date | null): number | undefined {
    if (resetAt === null) return undefined;

    return Math.max(0, Math.ceil((resetAt.getTime() - this.clock.now().getTime()) / 1000));
  }
}
