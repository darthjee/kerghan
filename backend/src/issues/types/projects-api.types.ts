import type { RepoRef } from '../../repositories/repositories.public.js';

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
