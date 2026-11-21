import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { duplicateEntryIndex } from './duplicate-entry.js';
import type { IssuesProject } from './entities/issues-project.entity.js';
import { IssuesConfig } from './issues-config.js';
import {
  projectNameTaken,
  projectNotFound,
  projectRepositoryNotAdded,
  projectRepositoryTaken,
  projectsLimitReached,
  repositoryNotFound,
} from './issues-http-errors.js';
import { ProjectOpenIssueCounts } from './open-issue-count.query.js';
import { projectResponse } from './project-response.js';
import { ProjectStore } from './project-store.js';
import { AccountHandleService } from '../auth/account-handle.service.js';
import { Clock } from '../core/clock.js';
import type { ProjectRepositoryLookup, RepoRef } from '../repositories/repositories.public.js';
import { RepositoriesService } from '../repositories/repositories.service.js';
import type { CreationMode, CreationResult, ProjectCreationInput } from './types/projects-api.types.js';

// The unique indexes a creation race can hit (`model.md#issues_projects`).
const NAME_INDEX = 'idx_issues_projects_user_id_name_deleted_token';
const REPOSITORY_INDEX = 'idx_issues_projects_user_id_repository_id_deleted_token';
// The longest project name, in code points: a longer `owner/name` default is cut to it.
const MAX_NAME_CODE_POINTS = 100;

/**
 * The Projects business logic (`docs/agents/specs/issues/projects.md`). Nothing here calls GitHub
 * or enqueues a job: the constructor has no GitHub or queue dependency. Every project is reached
 * through `IssuesAccess` or a `user_id`-scoped store read, and the user's repository rows only
 * through the exported `RepositoriesService`.
 */
@Injectable()
export class ProjectsService {
  /**
   * @param {DataSource} dataSource - Opens the creation transaction.
   * @param {ProjectStore} store - The `issues_projects` reads and writes.
   * @param {ProjectOpenIssueCounts} counts - The open-issue counts.
   * @param {RepositoriesService} repositories - The caller's repository rows.
   * @param {AccountHandleService} accounts - The exclusive user-row lock of the cap check.
   * @param {IssuesConfig} config - The per-user project cap.
   * @param {Clock} clock - The time source of the timestamps.
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly store: ProjectStore,
    private readonly counts: ProjectOpenIssueCounts,
    private readonly repositories: RepositoriesService,
    private readonly accounts: AccountHandleService,
    private readonly config: IssuesConfig,
    private readonly clock: Clock,
  ) {}

  /**
   * The one creation method of both routes (`docs/agents/specs/issues/api/projects.md#project-creation`),
   * in the order of its checks: the repository ref (`404`, not added), the repository's existing
   * project (`409`, or the shortcut's `200`), the name, then, in one transaction under the
   * exclusive user-row lock, the cap and the insert. Simultaneous creations are decided by the
   * unique indexes.
   * @param {number} userId - The session's user.
   * @param {ProjectCreationInput} input - The validated input (`description` already normalized).
   * @param {CreationMode} mode - `explicit` or `shortcut`.
   * @returns {Promise<CreationResult>} `201` and the new project, or `200` and the shortcut's existing one.
   * @throws {NotFoundException} `NOT_FOUND` for a ref that is not among the caller's rows.
   * @throws {ConflictException} `PROJECT_REPOSITORY_NOT_ADDED`, `PROJECT_REPOSITORY_TAKEN`,
   *   `PROJECT_NAME_TAKEN` or `PROJECTS_LIMIT_REACHED`.
   */
  async create(userId: number, input: ProjectCreationInput, mode: CreationMode): Promise<CreationResult> {
    const lookup = input.repository === null ? null : await this.#lookup(userId, input.repository);
    const existing = lookup === null ? null : await this.store.findLiveByRepository(userId, lookup.repositoryId);

    if (existing !== null && lookup !== null) {
      return this.#existing(userId, existing, lookup, mode);
    }

    const name = this.#nameOf(input, lookup);

    if (await this.store.findLiveByName(userId, name) !== null) throw projectNameTaken();

    try {
      const project = await this.#insert(userId, name, input, lookup);

      return { status: 201, project: projectResponse(project, lookup?.summary, 0) };
    } catch (error) {
      return this.#lostRace(userId, error, lookup, mode);
    }
  }

  /**
   * @param {number} userId - The session's user.
   * @param {RepoRef} ref - The validated ref.
   * @returns {Promise<ProjectRepositoryLookup>} The caller's repository row.
   */
  async #lookup(userId: number, ref: RepoRef): Promise<ProjectRepositoryLookup> {
    const lookup = await this.repositories.resolveForProject(userId, ref);

    if (lookup === null) throw repositoryNotFound();
    if (!lookup.added) throw projectRepositoryNotAdded();

    return lookup;
  }

  /**
   * The repository already has a live project: refused on the explicit path, returned (with its
   * current open-issue count, never refused by the cap) on the shortcut.
   * @param {number} userId - The session's user.
   * @param {IssuesProject} existing - The existing live project.
   * @param {ProjectRepositoryLookup} lookup - Its repository row.
   * @param {CreationMode} mode - The route.
   * @returns {Promise<CreationResult>} `200` and the project, on the shortcut.
   */
  async #existing(
    userId: number,
    existing: IssuesProject,
    lookup: ProjectRepositoryLookup,
    mode: CreationMode,
  ): Promise<CreationResult> {
    if (mode === 'explicit') throw projectRepositoryTaken(existing.uuid);

    const count = await this.counts.forProject(existing.id);

    return { status: 200, project: projectResponse(existing, lookup.summary, count) };
  }

  /**
   * @param {ProjectCreationInput} input - The validated input.
   * @param {ProjectRepositoryLookup | null} lookup - The resolved repository, if any.
   * @returns {string} The name given, or the repository's `owner/name` (cut to the name limit).
   */
  #nameOf(input: ProjectCreationInput, lookup: ProjectRepositoryLookup | null): string {
    if (input.name !== undefined) return input.name;
    if (lookup === null) throw new Error('A project needs a name or a repository to default it from');

    return [...lookup.summary.fullName].slice(0, MAX_NAME_CODE_POINTS).join('');
  }

  /**
   * The creating transaction: the user row is locked exclusively (so two creations of one user
   * are serialized and the cap cannot be overshot), the live projects are counted, and the row is
   * inserted.
   * @param {number} userId - The session's user.
   * @param {string} name - The project's name.
   * @param {ProjectCreationInput} input - The validated input.
   * @param {ProjectRepositoryLookup | null} lookup - The resolved repository, if any.
   * @returns {Promise<IssuesProject>} The new project.
   */
  #insert(
    userId: number,
    name: string,
    input: ProjectCreationInput,
    lookup: ProjectRepositoryLookup | null,
  ): Promise<IssuesProject> {
    return this.dataSource.transaction(async (manager) => {
      if (!(await this.accounts.lockExistingUserForUpdate(userId, manager))) throw projectNotFound();
      if (await this.store.countLive(userId, manager) >= this.config.maxProjectsPerUser) throw projectsLimitReached();

      const now = this.#now();

      return this.store.insert(manager, {
        uuid: randomUUID(),
        userId,
        name,
        description: input.description,
        repositoryId: lookup?.repositoryId ?? null,
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  /**
   * Maps a unique-index violation of the insert to its refusal: the name index is
   * `PROJECT_NAME_TAKEN`; the repository index re-reads the winner, answering
   * `PROJECT_REPOSITORY_TAKEN` on the explicit path and the winner's `200` on the shortcut.
   * Anything else is rethrown.
   * @param {number} userId - The session's user.
   * @param {unknown} error - What the insert threw.
   * @param {ProjectRepositoryLookup | null} lookup - The resolved repository, if any.
   * @param {CreationMode} mode - The route.
   * @returns {Promise<CreationResult>} The shortcut's `200` for the winner.
   */
  async #lostRace(
    userId: number,
    error: unknown,
    lookup: ProjectRepositoryLookup | null,
    mode: CreationMode,
  ): Promise<CreationResult> {
    const index = duplicateEntryIndex(error);

    if (index === NAME_INDEX) throw projectNameTaken();
    if (index !== REPOSITORY_INDEX || lookup === null) throw error;

    const winner = await this.store.findLiveByRepository(userId, lookup.repositoryId);

    if (winner === null) throw error;

    return this.#existing(userId, winner, lookup, mode);
  }

  /**
   * @returns {Date} The clock's now, in whole seconds (`datetime` keeps no fraction).
   */
  #now(): Date {
    return new Date(Math.floor(this.clock.now().getTime() / 1000) * 1000);
  }
}
