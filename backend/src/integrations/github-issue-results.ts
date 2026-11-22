/**
 * The typed, normalised results of the issue operations of the exported
 * `IntegrationsGithubService` and `IntegrationsGithubIssueWriter`
 * (see `docs/agents/specs/issues/sync.md#github-issue-client-operations`). They are
 * part of the module's export surface: no credential, minted token, `secret_iv`,
 * URL or GitHub body ever appears in them.
 */
import type { RepoFailure } from './github-repo-results.js';

/** The repository an issue operation targets: the repository row's id and names. */
export interface GithubIssueRepo {
  githubId: number;
  owner: string;
  name: string;
}

/** One GitHub issue, reduced to the fields the Issues model stores. */
export interface GithubIssue {
  id: number;
  number: number;
  title: string;
  /** Verbatim, except that a missing or blank body is `null`. */
  body: string | null;
  state: 'open' | 'closed';
  updatedAt: Date;
  /** `true` when GitHub's object has a `pull_request` member. */
  isPullRequest: boolean;
}

/** The only fields the writer may send. */
export interface GithubIssueChanges {
  title?: string;
  body?: string | null;
  state?: 'open' | 'closed';
}

/** The new names of a repository whose issue was reached through a rename redirect. */
export interface RenamedTo {
  owner: string;
  name: string;
}

/** The failure kinds specific to issue operations. */
export type IssueFailure =
  | { kind: 'not_found' }
  | { kind: 'gone' }
  | { kind: 'moved' }
  | { kind: 'forbidden' };

/** One issue read (`GET /repos/{owner}/{name}/issues/{number}`). */
export type IssueResult =
  | { kind: 'ok'; issue: GithubIssue; etag: string | null; renamedTo?: RenamedTo }
  | { kind: 'not_modified' }
  | IssueFailure
  | RepoFailure;

/** One issue written (`PATCH /repos/{owner}/{name}/issues/{number}`). */
export type IssueUpdateResult =
  | { kind: 'ok'; issue: GithubIssue; renamedTo?: RenamedTo }
  | IssueFailure
  | RepoFailure;

/** The issues-access probe (`GET /repos/{owner}/{name}/issues?per_page=1`). */
export type IssueProbeResult =
  | { kind: 'ok' }
  | { kind: 'not_found' }
  | { kind: 'forbidden' }
  | RepoFailure;
