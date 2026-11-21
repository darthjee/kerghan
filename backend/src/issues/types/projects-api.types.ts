import type { RepoRef } from '../../repositories/repositories.public.js';
import type { ProjectResponse } from '../project-response.js';

/**
 * The typed inputs of the Projects services (`docs/agents/specs/issues/api/projects.md`): plain
 * values, no DTO classes and no HTTP types. The controller owns validation and response shaping.
 */

/** The projects listing's validated input. */
export interface ListProjectsInput {
  /** 1-based page. */
  page: number;
  perPage: number;
  /** Trimmed literal substring of the name; empty means no search. */
  search: string;
}

/** The two creation routes: the explicit form or the shortcut from an added repository. */
export type CreationMode = 'explicit' | 'shortcut';

/**
 * What both creation routes hand the one service method: the explicit form always has a `name`,
 * the shortcut always has a `repository` and defaults the name to `owner/name`.
 */
export interface ProjectCreationInput {
  name?: string;
  description: string | null;
  repository: RepoRef | null;
}

/** Explicit creation's input; `description` is already normalized (blank becomes `null`). */
export interface CreateProjectInput {
  name: string;
  description: string | null;
  /** `null` makes a non-code project. */
  repository: RepoRef | null;
}

/** The shortcut's input; `name` defaults to `owner/name` when absent. */
export interface ProjectFromRepositoryInput {
  repository: RepoRef;
  name?: string;
  description: string | null;
}

/** Edit's input: an absent member is left as it is; `description: null` clears it. */
export interface EditProjectInput {
  name?: string;
  description?: string | null;
}

/** The repository route's input: `null` detaches. */
export interface ProjectRepositoryInput {
  repository: RepoRef | null;
}

/** The creation result: `201` for a new project, `200` for the shortcut's existing one. */
export interface CreationResult {
  status: 200 | 201;
  project: ProjectResponse;
}
