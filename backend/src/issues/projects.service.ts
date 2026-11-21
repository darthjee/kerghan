import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { duplicateEntryIndex } from './duplicate-entry.js';
import type { IssuesProject } from './entities/issues-project.entity.js';
import { IssuesAccess } from './issues-access.js';
import { projectNameTaken, projectNotFound } from './issues-http-errors.js';
import { ProjectOpenIssueCounts } from './open-issue-count.query.js';
import { ProjectCreator } from './project-creator.js';
import { ProjectLinks } from './project-links.js';
import { ProjectRepositoryChanger } from './project-repository-changer.js';
import {
  deleteResponse,
  listingResponse,
  projectResponse,
  type ProjectDeleteResponse,
  type ProjectListingResponse,
  type ProjectResponse,
} from './project-response.js';
import { type ProjectChanges, ProjectStore } from './project-store.js';
import { stampOf } from './timestamps.js';
import { Clock } from '../core/clock.js';
import { RepositoriesService } from '../repositories/repositories.service.js';
import type {
  CreationMode,
  CreationResult,
  EditProjectInput,
  ListProjectsInput,
  ProjectCreationInput,
  ProjectRepositoryInput,
} from './types/projects-api.types.js';

// The unique index a rename race can hit (`model.md#issues_projects`).
const NAME_INDEX = 'idx_issues_projects_user_id_name_deleted_token';

/**
 * The Projects business logic (`docs/agents/specs/issues/projects.md`): the one surface of the
 * project controller, with typed inputs and the wire shapes as outputs. Every single-project
 * route resolves the project through `IssuesAccess` (no scattered `user_id` filter for access);
 * the listing's `WHERE user_id` is the listing's own scope. Nothing here calls GitHub or
 * enqueues a job, and the user's repository rows are read only through `RepositoriesService`.
 */
@Injectable()
export class ProjectsService {
  /**
   * @param {IssuesAccess} access - The single "this user's live project, or 404" check.
   * @param {ProjectStore} store - The `issues_projects` reads and writes.
   * @param {ProjectOpenIssueCounts} counts - The open-issue counts.
   * @param {RepositoriesService} repositories - The caller's repository rows.
   * @param {ProjectCreator} creator - Creation, shared by both routes.
   * @param {ProjectRepositoryChanger} changer - Repository connect, change and detach.
   * @param {ProjectLinks} links - The project's issues, links and markers (deletion).
   * @param {DataSource} dataSource - Opens the deletion transaction.
   * @param {Clock} clock - The time source of `updated_at` and `deleted_at`.
   */
  constructor(
    private readonly access: IssuesAccess,
    private readonly store: ProjectStore,
    private readonly counts: ProjectOpenIssueCounts,
    private readonly repositories: RepositoriesService,
    private readonly creator: ProjectCreator,
    private readonly changer: ProjectRepositoryChanger,
    private readonly links: ProjectLinks,
    private readonly dataSource: DataSource,
    private readonly clock: Clock,
  ) {}

  /**
   * Creates a project (`docs/agents/specs/issues/api/projects.md#project-creation`), for both routes.
   * @param {number} userId - The session's user.
   * @param {ProjectCreationInput} input - The validated input.
   * @param {CreationMode} mode - `explicit` or `shortcut`.
   * @returns {Promise<CreationResult>} `201` and the new project, or `200` and the shortcut's existing one.
   */
  create(userId: number, input: ProjectCreationInput, mode: CreationMode): Promise<CreationResult> {
    return this.creator.create(userId, input, mode);
  }

  /**
   * One page of the user's live projects, sorted by name, with each repository summary and
   * open-issue count read once for the whole page (`projectSummaries` and `forPage`, never one
   * query per project).
   * @param {number} userId - The session's user.
   * @param {ListProjectsInput} input - The validated page, page size and search.
   * @returns {Promise<ProjectListingResponse>} `{ projects, pagination }`; a page past the end is empty.
   */
  async list(userId: number, input: ListProjectsInput): Promise<ProjectListingResponse> {
    const { projects, total } = await this.store.page(userId, input);
    const [summaries, counts] = await Promise.all([
      this.repositories.projectSummaries(userId, projects.flatMap((project) => project.repositoryId ?? [])),
      this.counts.forPage(projects.map((project) => project.id)),
    ]);
    const rows = projects.map((project) => ({
      project,
      summary: project.repositoryId === null ? undefined : summaries.get(project.repositoryId),
      openIssueCount: counts.get(project.id) ?? 0,
    }));

    return listingResponse(rows, {
      page: input.page,
      perPage: input.perPage,
      total,
      totalPages: Math.ceil(total / input.perPage),
    });
  }

  /**
   * One of the user's live projects.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @returns {Promise<ProjectResponse>} The project object.
   * @throws {NotFoundException} `NOT_FOUND` when no live project of this user has that uuid.
   */
  async show(userId: number, projectUuid: string): Promise<ProjectResponse> {
    return this.#respond(userId, await this.access.findLiveProject(userId, projectUuid));
  }

  /**
   * Edits the name and/or description (`docs/agents/specs/issues/api/projects.md#project-edit`).
   * An omitted field is unchanged; `description: null` clears it. An empty body, or values equal
   * to the stored ones, answers the project with no write and no `updated_at` change. A taken
   * name (including a rename race lost on the unique index) is `PROJECT_NAME_TAKEN`.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @param {EditProjectInput} input - The validated input (`description` already normalized).
   * @returns {Promise<ProjectResponse>} The project object, as stored after the edit.
   * @throws {NotFoundException} `NOT_FOUND` when no live project of this user has that uuid.
   * @throws {ConflictException} `PROJECT_NAME_TAKEN`.
   */
  async edit(userId: number, projectUuid: string, input: EditProjectInput): Promise<ProjectResponse> {
    const project = await this.access.findLiveProject(userId, projectUuid);
    const changes = changesOf(project, input);

    if (changes === null) return this.#respond(userId, project);

    if (changes.name !== undefined) await this.#assertNameFree(userId, project, changes.name);

    const updatedAt = stampOf(this.clock);

    if (!(await this.#write(project, changes, updatedAt))) throw projectNotFound();

    return this.#respond(userId, Object.assign(project, changes, { updatedAt }));
  }

  /**
   * Connects, changes or detaches the project's repository
   * (`docs/agents/specs/issues/api/projects.md#project-repository`). Never syncs or enqueues a job.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @param {ProjectRepositoryInput} input - The validated input; `repository: null` detaches.
   * @returns {Promise<ProjectResponse>} The project object, as stored after the change.
   * @throws {NotFoundException} `NOT_FOUND` for a missing project or a ref that is not among the caller's rows.
   * @throws {ConflictException} `PROJECT_REPOSITORY_NOT_ADDED`, `PROJECT_REPOSITORY_TAKEN` or `PROJECT_HAS_LINKS`.
   */
  async setRepository(userId: number, projectUuid: string, input: ProjectRepositoryInput): Promise<ProjectResponse> {
    return this.#respond(userId, await this.changer.change(userId, projectUuid, input.repository));
  }

  /**
   * Deletes a project: one transaction in the module's lock order. The project row is locked, its
   * issues that have a pending marker are counted, its markers, links and issues are hard-deleted,
   * and the row becomes a tombstone (`description` cleared, `deleted_at` and `deleted_token`
   * written together), which frees its name and repository. Makes no GitHub call; a repeat
   * answers `404`.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @returns {Promise<ProjectDeleteResponse>} `{ unsentIssueCount }`, counted before the delete.
   * @throws {NotFoundException} `NOT_FOUND` when no live project of this user has that uuid.
   */
  async delete(userId: number, projectUuid: string): Promise<ProjectDeleteResponse> {
    const unsentIssueCount = await this.dataSource.transaction(async (manager) => {
      const project = await this.access.findLiveProject(userId, projectUuid, manager, { lock: true });
      const unsent = await this.links.purge(manager, project.id);

      if (!(await this.store.markDeleted(manager, project.id, stampOf(this.clock)))) throw projectNotFound();

      return unsent;
    });

    return deleteResponse(unsentIssueCount);
  }

  /**
   * The project object: its repository summary (one lookup) and its open-issue count (one `COUNT`).
   * @param {number} userId - The session's user.
   * @param {IssuesProject} project - A live project of the user.
   * @returns {Promise<ProjectResponse>} The wire shape.
   */
  async #respond(userId: number, project: IssuesProject): Promise<ProjectResponse> {
    const [summaries, count] = await Promise.all([
      this.repositories.projectSummaries(userId, project.repositoryId === null ? [] : [project.repositoryId]),
      this.counts.forProject(project.id),
    ]);

    return projectResponse(project, project.repositoryId === null ? undefined : summaries.get(project.repositoryId), count);
  }

  /**
   * @param {number} userId - The session's user.
   * @param {IssuesProject} project - The project being renamed.
   * @param {string} name - The new name.
   * @returns {Promise<void>} Resolves when no other live project of the user has the name.
   */
  async #assertNameFree(userId: number, project: IssuesProject, name: string): Promise<void> {
    const holder = await this.store.findLiveByName(userId, name);

    if (holder !== null && holder.id !== project.id) throw projectNameTaken();
  }

  /**
   * @param {IssuesProject} project - The project.
   * @param {ProjectChanges} changes - The fields to write.
   * @param {Date} updatedAt - The new `updated_at`.
   * @returns {Promise<boolean>} Whether a live row was written.
   */
  async #write(project: IssuesProject, changes: ProjectChanges, updatedAt: Date): Promise<boolean> {
    try {
      return await this.store.update(project.id, changes, updatedAt);
    } catch (error) {
      if (duplicateEntryIndex(error) === NAME_INDEX) throw projectNameTaken();

      throw error;
    }
  }
}

/**
 * The fields of an edit that differ from the stored ones.
 * @param {IssuesProject} project - The stored project.
 * @param {EditProjectInput} input - The validated input.
 * @returns {ProjectChanges | null} The changes, or `null` when there is nothing to write.
 */
function changesOf(project: IssuesProject, input: EditProjectInput): ProjectChanges | null {
  const changes: ProjectChanges = {};

  if (input.name !== undefined && input.name !== project.name) changes.name = input.name;
  if (input.description !== undefined && input.description !== project.description) changes.description = input.description;

  return Object.keys(changes).length === 0 ? null : changes;
}
