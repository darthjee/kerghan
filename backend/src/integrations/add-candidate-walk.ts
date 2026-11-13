/**
 * Add's re-check candidate walk (see
 * `docs/agents/specs/repos/integrations.md#add-re-check-candidates` and
 * `#access-link-on-add`). A pure function, exported with
 * `IntegrationsGithubService`: Repositories computes its inputs (which
 * integrations hold a source row, whether the handle source sees the repo)
 * and maps its outcome to HTTP answers; the real service and the typed fake
 * share it.
 */
import type { GithubRepo, IntegrationRef, RepoResult, UnavailableReason } from './github-repo-results.js';

// The most GitHub calls one Add makes.
export const ADD_WALK_MAX_CALLS = 3;

/** What the walk needs. */
export interface AddWalkInput {
  userId: number;
  githubId: number;
  /** Internal ids of the integrations holding a source row for the repo. */
  holderIntegrationIds: readonly number[];
  /** Whether the handle source holds the repo. */
  handleSeesRepo: boolean;
  /** The user's usable integrations, oldest first (`listUsableIntegrations`). */
  usable: readonly IntegrationRef[];
}

/** How the walk ended. */
export type AddWalkResult =
  | { kind: 'ok'; repo: GithubRepo; linkIntegrationId: number | null }
  | { kind: 'denied' }
  | { kind: 'no_candidate' }
  | { kind: 'rate_limited'; resetAt: Date | null }
  | { kind: 'unavailable'; reason: UnavailableReason };

/** The re-check call: `IntegrationsGithubService#getRepository`. */
export type GetRepository = (userId: number, integrationId: number | null, githubId: number) => Promise<RepoResult>;

interface Candidate {
  integrationId: number | null;
  holder: boolean;
}

/**
 * Walks the candidates in order, with at most 3 GitHub calls:
 * 1. the usable holders, oldest first;
 * 2. when the handle source sees the repo, the other usable integrations,
 *    oldest first, then unauthenticated.
 *
 * `invalid_credentials` / `not_found` (a `403` or `404`) move on; a rate
 * limit or `unavailable` stops the walk; `integration_unusable` moves on
 * without counting a call. A holder links itself; any other candidate links
 * only when it found the repo private (unauthenticated never links).
 * @param {AddWalkInput} input - The candidates' inputs.
 * @param {GetRepository} getRepository - The re-check call.
 * @returns {Promise<AddWalkResult>} How the walk ended.
 */
export async function walkAddCandidates(input: AddWalkInput, getRepository: GetRepository): Promise<AddWalkResult> {
  const candidates = addCandidates(input);

  if (candidates.length === 0) {
    return { kind: 'no_candidate' };
  }

  let calls = 0;

  for (const candidate of candidates) {
    if (calls >= ADD_WALK_MAX_CALLS) {
      break;
    }

    const result = await getRepository(input.userId, candidate.integrationId, input.githubId);
    const outcome = outcomeOf(candidate, result);

    if (outcome !== null) {
      return outcome;
    }

    calls += result.kind === 'integration_unusable' ? 0 : 1;
  }

  return { kind: 'denied' };
}

/**
 * The ordered candidates.
 * @param {AddWalkInput} input - The walk's inputs.
 * @returns {Candidate[]} The candidates, `null` for unauthenticated.
 */
function addCandidates(input: AddWalkInput): Candidate[] {
  const holders = new Set(input.holderIntegrationIds);
  const usableHolders = input.usable.filter((ref) => holders.has(ref.id));
  const candidates: Candidate[] = usableHolders.map((ref) => ({ integrationId: ref.id, holder: true }));

  if (input.handleSeesRepo) {
    input.usable
      .filter((ref) => !holders.has(ref.id))
      .forEach((ref) => candidates.push({ integrationId: ref.id, holder: false }));
    candidates.push({ integrationId: null, holder: false });
  }

  return candidates;
}

/**
 * What one re-check means for the walk.
 * @param {Candidate} candidate - The candidate called.
 * @param {RepoResult} result - Its answer.
 * @returns {AddWalkResult | null} The walk's end, or `null` to move on.
 */
function outcomeOf(candidate: Candidate, result: RepoResult): AddWalkResult | null {
  switch (result.kind) {
    case 'ok':
      return { kind: 'ok', repo: result.repo, linkIntegrationId: linkFor(candidate, result.repo) };
    case 'rate_limited':
    case 'unavailable':
      return result;
    default:
      return null;
  }
}

/**
 * The integration to link: a holder links itself; another candidate only
 * when the repo is private.
 * @param {Candidate} candidate - The granting candidate.
 * @param {GithubRepo} repo - The re-checked repo.
 * @returns {number | null} The integration id to store, or `null`.
 */
function linkFor(candidate: Candidate, repo: GithubRepo): number | null {
  return candidate.holder || repo.private ? candidate.integrationId : null;
}
