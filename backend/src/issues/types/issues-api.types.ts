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

/** Bulk close/reopen's input: the lowercased issue uuids, in request order, and the target state. */
export interface BulkIssueStateInput {
  issueIds: string[];
  state: IssueState;
}

/** Bulk close/reopen's wire shape: each requested id lands in exactly one of the three lists. */
export interface BulkIssueStateResponse {
  state: IssueState;
  changed: string[];
  unchanged: string[];
  notFound: string[];
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

/** What a sync trigger answers: the HTTP status (`200` when nothing was enqueued, else `202`) and the body. */
export interface TriggerResult<T> {
  status: number;
  body: T;
}

/** T2's wire shape: the issue, and whether the refresh was skipped because the link is already fresh. */
export interface RefreshIssueResponse {
  issue: IssueResponse;
  alreadyFresh: boolean;
}

/** T3's wire shape: how many reconciles were enqueued, and how many fresh links were skipped. */
export interface RefreshProjectResponse {
  enqueued: number;
  skippedFresh: number;
}

/** T4's wire shape: the issue, after the reset. */
export interface RetrySyncResponse {
  issue: IssueResponse;
}
