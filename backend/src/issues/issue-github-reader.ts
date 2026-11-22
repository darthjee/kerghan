import { Injectable } from '@nestjs/common';
import { IssueCandidates } from './issue-candidates.js';
import { Clock } from '../core/clock.js';
import {
  IntegrationsGithubService,
  type GithubIssue,
  type GithubIssueRepo,
  type IssueResult,
} from '../integrations/integrations-github.public.js';

/** Why no credential could read the issue (`GITHUB_CREDENTIAL_UNUSABLE`'s `meta.reason`). */
export type CredentialReason = 'no_credential' | 'credential_invalid' | 'forbidden';

/** What the single GitHub read of a link creation came to; the service never sees a status code. */
export type LinkReadOutcome =
  | { kind: 'ok'; issue: GithubIssue; etag: string | null; integrationId: number }
  | { kind: 'not_found' }
  | { kind: 'rate_limited'; retryAfterSeconds: number | null }
  | { kind: 'credential'; reason: CredentialReason }
  | { kind: 'unavailable' };

/** One candidate's answer, reduced: a final outcome, or a credential failure to fall back from. */
type Step = { final: LinkReadOutcome } | { fallback: 'forbidden' | 'credential_invalid' };

/**
 * The single GitHub read of link creation (E57 to E60): walks the candidates of
 * `IssueCandidates` and turns the answer into a `LinkReadOutcome`. It never sends an ETag, so a
 * `not_modified` cannot be a valid answer and is treated as `unavailable`.
 *
 * Only credential failures (`invalid_credentials`, `forbidden`, `integration_unusable`) fall back
 * to the next candidate; a rate limit, an unavailable GitHub, `not_found`, `gone` or `moved` ends
 * the walk at once. A `renamedTo` hint on an answer is ignored: the rename hand-off belongs to the
 * sync, not to link creation.
 * It logs nothing: a refusal after the read is recorded by the access line alone.
 */
@Injectable()
export class IssueGithubReader {
  /**
   * @param {IssueCandidates} candidates - The ordered integrations to try.
   * @param {IntegrationsGithubService} github - The GitHub issue client (read-only).
   * @param {Clock} clock - The time source (the rate-limit delay).
   */
  constructor(
    private readonly candidates: IssueCandidates,
    private readonly github: IntegrationsGithubService,
    private readonly clock: Clock,
  ) {}

  /**
   * Reads one GitHub issue for a link, with the first candidate integration that can.
   * @param {number} userId - The owner of the project.
   * @param {number} repositoryId - The project's internal repository id.
   * @param {GithubIssueRepo} repo - The repository row's id and names.
   * @param {number} number - The GitHub issue number.
   * @returns {Promise<LinkReadOutcome>} The normalised outcome. No GitHub call is made when there
   *   is no candidate.
   */
  async readForLink(userId: number, repositoryId: number, repo: GithubIssueRepo, number: number): Promise<LinkReadOutcome> {
    const resolution = await this.candidates.resolve(userId, repositoryId);

    if (resolution.kind === 'none') return { kind: 'credential', reason: resolution.reason };

    let sawForbidden = false;

    for (const integrationId of resolution.ids) {
      const step = this.#step(await this.github.getIssue(userId, integrationId, repo, number), integrationId);

      if ('final' in step) return step.final;

      sawForbidden ||= step.fallback === 'forbidden';
    }

    return { kind: 'credential', reason: sawForbidden ? 'forbidden' : 'credential_invalid' };
  }

  /**
   * Classifies one candidate's answer.
   * @param {IssueResult} result - The client's typed result.
   * @param {number} integrationId - The integration that answered.
   * @returns {Step} A final outcome, or the credential failure to fall back from.
   */
  #step(result: IssueResult, integrationId: number): Step {
    switch (result.kind) {
      case 'ok':
        return { final: { kind: 'ok', issue: result.issue, etag: result.etag, integrationId } };
      case 'not_found':
      case 'gone':
      case 'moved':
        return { final: { kind: 'not_found' } };
      case 'rate_limited':
        return { final: { kind: 'rate_limited', retryAfterSeconds: this.#secondsUntil(result.resetAt) } };
      case 'forbidden':
        return { fallback: 'forbidden' };
      case 'invalid_credentials':
      case 'integration_unusable':
        return { fallback: 'credential_invalid' };
      default:
        return { final: { kind: 'unavailable' } };
    }
  }

  /**
   * @param {Date | null} resetAt - GitHub's reset time, when known.
   * @returns {number | null} Whole seconds until then (rounded up, at least 1), or `null` when unknown.
   */
  #secondsUntil(resetAt: Date | null): number | null {
    if (resetAt === null) return null;

    return Math.max(1, Math.ceil((resetAt.getTime() - this.clock.now().getTime()) / 1000));
  }
}
