import type { Issue } from './entities/issue.entity.js';
import type { IssueLinkResponse } from './issue-link-presenter.js';
import type { IssueListRecord } from './issue-store.js';

/**
 * The wire shapes of the Issues API (`docs/agents/specs/issues/api/issues.md`). These pure
 * functions are the only path from an issue row to a response: every field is copied explicitly
 * (never spread), so no internal field (the issue `id`, `project_id`) can leak. Dates become ISO
 * strings: `createdAt` keeps second precision (a `datetime` column), `updatedAt` keeps its
 * milliseconds (`datetime(3)`).
 */

/** The issue object (`GET`-style show, create and edit body). */
export interface IssueResponse {
  id: string;
  title: string;
  body: string | null;
  state: string;
  createdAt: string;
  updatedAt: string;
  link: IssueLinkResponse | null;
}

/** A listing row: the issue object without `body`. */
export type IssueListRowResponse = Omit<IssueResponse, 'body'>;

/** The pagination block of a listing. */
export interface IssuesPagination {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

/** The listing body. */
export interface IssueListingResponse {
  issues: IssueListRowResponse[];
  pagination: IssuesPagination;
}

/** The delete body. */
export type IssueDeleteResponse = Record<string, never>;

/**
 * The issue object.
 * @param {Issue} issue - The issue row.
 * @param {IssueLinkResponse | undefined} link - Its link object, `undefined` when it has none.
 * @returns {IssueResponse} The wire shape (`id` is the uuid, `link` is `null` without a link).
 */
export function issueResponse(issue: Issue, link: IssueLinkResponse | undefined): IssueResponse {
  return {
    id: issue.uuid,
    title: issue.title,
    body: issue.body,
    state: issue.state,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
    link: link ?? null,
  };
}

/**
 * A listing row: the issue object without `body`.
 * @param {IssueListRecord} issue - The row, loaded without its body.
 * @param {IssueLinkResponse | undefined} link - Its link object, `undefined` when it has none.
 * @returns {IssueListRowResponse} The wire shape.
 */
export function issueListRow(issue: IssueListRecord, link: IssueLinkResponse | undefined): IssueListRowResponse {
  return {
    id: issue.uuid,
    title: issue.title,
    state: issue.state,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
    link: link ?? null,
  };
}

/**
 * The listing body.
 * @param {IssueListRecord[]} rows - The page's rows, in order.
 * @param {Map<number, IssueLinkResponse>} links - The page's link objects, by issue id.
 * @param {IssuesPagination} pagination - The page and the filtered totals.
 * @returns {IssueListingResponse} `{ issues, pagination }`.
 */
export function issueListingResponse(
  rows: IssueListRecord[],
  links: Map<number, IssueLinkResponse>,
  pagination: IssuesPagination,
): IssueListingResponse {
  return {
    issues: rows.map((row) => issueListRow(row, links.get(row.id))),
    pagination: {
      page: pagination.page,
      perPage: pagination.perPage,
      total: pagination.total,
      totalPages: pagination.totalPages,
    },
  };
}

/**
 * The delete body.
 * @returns {IssueDeleteResponse} `{}`.
 */
export function issueDeleteResponse(): IssueDeleteResponse {
  return {};
}
