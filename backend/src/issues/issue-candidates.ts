import { Injectable } from '@nestjs/common';
import { IntegrationsGithubService, type IntegrationRef, type IssuesWriteCapability } from '../integrations/integrations-github.public.js';
import { RepositoriesService } from '../repositories/repositories.service.js';

/** Why no integration can read a repository's issues. */
export type NoCandidateReason = 'no_credential' | 'credential_invalid';

/** The integrations to try for a repository, in order, or why there are none. */
export type CandidateResolution =
  | { kind: 'candidates'; ids: number[] }
  | { kind: 'none'; reason: NoCandidateReason };

// The candidate order: known writable first, then unknown, then known read-only.
const WRITE_ORDER: Record<IssuesWriteCapability, number> = { writable: 0, unknown: 1, read_only: 2 };

/**
 * The integration selection of `docs/agents/specs/issues/sync.md#integration-selection`: which of
 * the user's integrations may call GitHub for a repository, in the order to try them. A candidate
 * is a usable integration whose source lists the repository (a GitHub handle alone is never one,
 * E20), ordered by known write capability (writable, then unknown, then read-only) and oldest
 * first inside each group. Nothing stores an integration id: it is resolved on every call.
 *
 * #557 uses it for the single read of link creation. #558 reuses it for refresh and push and adds
 * the skip of candidates that are paused by a rate limit.
 */
@Injectable()
export class IssueCandidates {
  /**
   * @param {RepositoriesService} repositories - Which integrations list a repository.
   * @param {IntegrationsGithubService} github - The user's integrations (database reads only).
   */
  constructor(
    private readonly repositories: RepositoriesService,
    private readonly github: IntegrationsGithubService,
  ) {}

  /**
   * Resolves the ordered candidates for a repository.
   * @param {number} userId - The owner of the project.
   * @param {number} repositoryId - The internal repository id.
   * @returns {Promise<CandidateResolution>} The ordered integration ids, or the reason there is none:
   *   `credential_invalid` when an integration lists the repository but is not usable,
   *   `no_credential` otherwise.
   */
  async resolve(userId: number, repositoryId: number): Promise<CandidateResolution> {
    const [sourceIds, usable, all] = await Promise.all([
      this.repositories.integrationSourceIds(userId, repositoryId),
      this.github.listUsableIntegrations(userId),
      this.github.listIntegrations(userId),
    ]);
    const sources = new Set(sourceIds);
    const candidates = usable.filter((integration) => sources.has(integration.id));

    if (candidates.length > 0) {
      return { kind: 'candidates', ids: orderByCapability(candidates).map((integration) => integration.id) };
    }

    return { kind: 'none', reason: all.some((integration) => sources.has(integration.id)) ? 'credential_invalid' : 'no_credential' };
  }
}

/**
 * A stable sort by capability group; `usable` is already oldest first, so that order is kept
 * inside each group.
 * @param {IntegrationRef[]} candidates - The candidates, oldest first.
 * @returns {IntegrationRef[]} The ordered copy.
 */
function orderByCapability(candidates: IntegrationRef[]): IntegrationRef[] {
  return [...candidates].sort((a, b) => WRITE_ORDER[a.issuesWrite] - WRITE_ORDER[b.issuesWrite]);
}
