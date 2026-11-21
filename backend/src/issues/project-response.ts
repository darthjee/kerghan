import type { RepositorySummary } from '../repositories/repositories.public.js';
import type { IssuesProject } from './entities/issues-project.entity.js';

/**
 * The wire shapes of the Projects API (`docs/agents/specs/issues/api/projects.md#project-object`).
 * These pure functions are the only path from a project row to a response: every field is copied
 * explicitly (never spread), so no internal field (the project `id`, `user_id`, `repository_id`,
 * the deletion columns) can leak. Dates become ISO strings.
 */

/** The repository of a project: the summary, or its dangling form. */
export interface ProjectRepositoryResponse {
  githubId: number | null;
  owner: string | null;
  name: string | null;
  fullName: string | null;
  private: boolean | null;
  status: string;
}

/** The project object, also the listing row. */
export interface ProjectResponse {
  id: string;
  name: string;
  description: string | null;
  repository: ProjectRepositoryResponse | null;
  openIssueCount: number;
  createdAt: string;
  updatedAt: string;
}

/** The pagination block of a listing. */
export interface ProjectsPagination {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

/** A listing row: a project, its repository summary (when found) and its open-issue count. */
export interface ProjectListRow {
  project: IssuesProject;
  summary: RepositorySummary | undefined;
  openIssueCount: number;
}

/** The listing body. */
export interface ProjectListingResponse {
  projects: ProjectResponse[];
  pagination: ProjectsPagination;
}

/** The delete body. */
export interface ProjectDeleteResponse {
  unsentIssueCount: number;
}

/** What a dangling repository reference reads as: unavailable, with every snapshot field `null`. */
const DANGLING: ProjectRepositoryResponse = {
  githubId: null,
  owner: null,
  name: null,
  fullName: null,
  private: null,
  status: 'unavailable',
};

/**
 * @param {IssuesProject} project - The project.
 * @param {RepositorySummary | undefined} summary - Its repository's summary, `undefined` when
 *   the stored reference is dangling (ignored for a project without a repository).
 * @returns {ProjectRepositoryResponse | null} `null` for a non-code project, the dangling form
 *   for a missing row, else the summary.
 */
function repositoryOf(project: IssuesProject, summary: RepositorySummary | undefined): ProjectRepositoryResponse | null {
  if (project.repositoryId === null) return null;
  if (summary === undefined) return { ...DANGLING };

  return {
    githubId: summary.githubId,
    owner: summary.owner,
    name: summary.name,
    fullName: summary.fullName,
    private: summary.private,
    status: summary.status,
  };
}

/**
 * The project object.
 * @param {IssuesProject} project - The project row.
 * @param {RepositorySummary | undefined} summary - Its repository's summary, when found.
 * @param {number} openIssueCount - The number of its open issues.
 * @returns {ProjectResponse} The wire shape (`id` is the uuid).
 */
export function projectResponse(
  project: IssuesProject,
  summary: RepositorySummary | undefined,
  openIssueCount: number,
): ProjectResponse {
  return {
    id: project.uuid,
    name: project.name,
    description: project.description,
    repository: repositoryOf(project, summary),
    openIssueCount,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

/**
 * The listing body.
 * @param {ProjectListRow[]} rows - The page's rows, in order.
 * @param {ProjectsPagination} pagination - The page and the filtered totals.
 * @returns {ProjectListingResponse} `{ projects, pagination }`.
 */
export function listingResponse(rows: ProjectListRow[], pagination: ProjectsPagination): ProjectListingResponse {
  return {
    projects: rows.map((row) => projectResponse(row.project, row.summary, row.openIssueCount)),
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
 * @param {number} unsentIssueCount - The number of issues whose pending markers were discarded.
 * @returns {ProjectDeleteResponse} `{ unsentIssueCount }`.
 */
export function deleteResponse(unsentIssueCount: number): ProjectDeleteResponse {
  return { unsentIssueCount };
}
