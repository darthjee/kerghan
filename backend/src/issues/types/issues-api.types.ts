import type { IssueState } from '../entities/issue.entity.js';
import type { IssueResponse } from '../issue-response.js';

/**
 * The typed inputs of the IssuesService (`docs/agents/specs/issues/api/issues.md`): plain values,
 * no DTO classes and no HTTP types. The controller owns validation and response shaping.
 */

/** The listing's state filter. */
export type IssueStateFilter = IssueState | 'all';

/** The issues listing's validated input. */
export interface ListIssuesInput {
  /** 1-based page. */
  page: number;
  perPage: number;
  state: IssueStateFilter;
  /** Trimmed literal substring of the title; empty means no search. */
  search: string;
}

/** Create's input; `body` is already normalized (`''` becomes `null`). */
export interface CreateIssueInput {
  title: string;
  body: string | null;
  state: IssueState;
}

/** Edit's input: an absent member is left as it is; `body: null` clears it. */
export interface EditIssueInput {
  title?: string;
  body?: string | null;
  state?: IssueState;
}

/** Import's input: the GitHub issue number to import into the project. */
export interface ImportIssueInput {
  number: number;
}

/** Attach's input: the GitHub number, and the `updatedAt` instant the caller confirmed, if any. */
export interface AttachIssueInput {
  number: number;
  confirmUpdatedAt?: Date;
}

/** Unlink's input. */
export interface UnlinkIssueInput {
  discardUnsentChanges: boolean;
}

/** Unlink's wire shape: the unlinked issue, and whether unsent changes were dropped. */
export interface UnlinkIssueResponse {
  issue: IssueResponse;
  droppedUnsentChanges: boolean;
}
