import type { IssueProbeResult, IssueResult, IssueUpdateResult } from '../../github-issue-results.js';
import type { RepoPageResult, RepoResult } from '../../github-repo-results.js';

/**
 * The types of the shared GitHub builders: the operations a case can answer, the
 * typed result of any of them and the case itself (`github-builders.ts`
 * re-exports them).
 */

/** The exported operations a case can answer. */
export type GithubOperation =
  | 'listRepositories'
  | 'listHandleRepositories'
  | 'getRepository'
  | 'getIssue'
  | 'probeIssues'
  | 'updateIssue';

/** The typed result of any operation. */
export type GithubResult = RepoPageResult | RepoResult | IssueResult | IssueProbeResult | IssueUpdateResult;

/** How a listing body is shaped: a plain array, or `GET /installation/repositories`' object. */
export type ListingShape = 'array' | 'installation';

/** One builder case. */
export interface GithubCase {
  readonly name: string;
  /**
   * The raw `fetch` answer: a `Response`, a thrown error (timeout), or
   * `null` when the service answers without any GitHub call, or a sequence
   * of answers (a followed redirect makes two calls).
   */
  readonly raw:
    | ((shape: ListingShape) => Response)
    | { throws: () => unknown }
    | { sequence: ReadonlyArray<() => Response> }
    | null;
  /**
   * The typed result an operation answers for this case.
   * @param operation - The operation.
   * @returns The typed result.
   */
  resultFor(operation: GithubOperation): GithubResult;
}
