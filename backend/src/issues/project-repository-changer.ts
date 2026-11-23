import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { duplicateEntryIndex, PROJECT_REPOSITORY_INDEX } from './duplicate-entry.js';
import type { IssuesProject } from './entities/issues-project.entity.js';
import { IssuesAccess } from './issues-access.js';
import {
  projectHasLinks,
  projectNotFound,
  projectRepositoryNotAdded,
  projectRepositoryTaken,
  repositoryNotFound,
} from './issues-http-errors.js';
import { ProjectLinks } from './project-links.js';
import { ProjectStore } from './project-store.js';
import { stampOf } from './timestamps.js';
import { Clock } from '../core/clock.js';
import type { ProjectRepositoryLookup, RepoRef } from '../repositories/repositories.public.js';
import { RepositoriesService } from '../repositories/repositories.service.js';

// The unique index a repository change race can hit (`docs/agents/modules/issues/data-model.md#issues_projects`).

/**
 * Connects, changes or detaches a project's repository
 * (`docs/agents/backend/routes/issues/projects.md#project-repository`), behind
 * `ProjectsService#setRepository`. It never syncs, enqueues a job or calls GitHub. The project
 * row lock is taken first, so a link creation (which takes the same lock first) cannot leave a
 * link against a changed repository (E62).
 */
@Injectable()
export class ProjectRepositoryChanger {
  /**
   * @param {DataSource} dataSource - Opens the transaction.
   * @param {IssuesAccess} access - The single "this user's live project, or 404" check.
   * @param {ProjectStore} store - The `issues_projects` reads and writes.
   * @param {ProjectLinks} links - The project's link count.
   * @param {RepositoriesService} repositories - The caller's repository rows.
   * @param {Clock} clock - The time source of `updated_at`.
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly access: IssuesAccess,
    private readonly store: ProjectStore,
    private readonly links: ProjectLinks,
    private readonly repositories: RepositoriesService,
    private readonly clock: Clock,
  ) {}

  /**
   * Applies a repository change. The project is resolved first (so a foreign project always
   * answers its own `404`), then the ref (`404`, not added) outside the lock, then, under the
   * project row lock: a no-op for the same repository (or a detach without one), the link count
   * for a change or detach, the repository's uniqueness, and the write.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @param {RepoRef | null} ref - The new repository, or `null` to detach.
   * @returns {Promise<IssuesProject>} The project as stored after the change.
   * @throws {NotFoundException} `NOT_FOUND` for a missing project or a ref that is not among the caller's rows.
   * @throws {ConflictException} `PROJECT_REPOSITORY_NOT_ADDED`, `PROJECT_REPOSITORY_TAKEN` or `PROJECT_HAS_LINKS`.
   */
  async change(userId: number, projectUuid: string, ref: RepoRef | null): Promise<IssuesProject> {
    await this.access.findLiveProject(userId, projectUuid);

    const lookup = ref === null ? null : await this.#lookup(userId, ref);

    try {
      return await this.dataSource.transaction((manager) => this.#apply(manager, userId, projectUuid, lookup?.repositoryId ?? null));
    } catch (error) {
      throw await this.#lostRace(userId, error, lookup);
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
   * The locked part of the change.
   * @param {EntityManager} manager - The transaction.
   * @param {number} userId - The session's user.
   * @param {string} projectUuid - The project's public id.
   * @param {number | null} target - The new repository's internal id, or `null` to detach.
   * @returns {Promise<IssuesProject>} The project as stored.
   */
  async #apply(manager: EntityManager, userId: number, projectUuid: string, target: number | null): Promise<IssuesProject> {
    const project = await this.access.findLiveProject(userId, projectUuid, manager, { lock: true });

    if (project.repositoryId === target) return project;
    if (project.repositoryId !== null) await this.#assertNoLinks(manager, project);
    if (target !== null) await this.#assertRepositoryFree(manager, userId, project, target);

    const updatedAt = stampOf(this.clock);

    if (!(await this.store.update(project.id, { repositoryId: target }, updatedAt, manager))) throw projectNotFound();

    return Object.assign(project, { repositoryId: target, updatedAt });
  }

  /**
   * @param {EntityManager} manager - The transaction.
   * @param {IssuesProject} project - The locked project.
   * @returns {Promise<void>} Resolves when the project has no link.
   */
  async #assertNoLinks(manager: EntityManager, project: IssuesProject): Promise<void> {
    const linkCount = await this.links.count(manager, project.id);

    if (linkCount > 0) throw projectHasLinks(linkCount);
  }

  /**
   * @param {EntityManager} manager - The transaction.
   * @param {number} userId - The session's user.
   * @param {IssuesProject} project - The locked project.
   * @param {number} target - The new repository's internal id.
   * @returns {Promise<void>} Resolves when no other live project of the user is on the repository.
   */
  async #assertRepositoryFree(manager: EntityManager, userId: number, project: IssuesProject, target: number): Promise<void> {
    const holder = await this.store.findLiveByRepository(userId, target, manager);

    if (holder !== null && holder.id !== project.id) throw projectRepositoryTaken(holder.uuid);
  }

  /**
   * Maps a lost unique-index race on the update to `PROJECT_REPOSITORY_TAKEN` with the winner;
   * anything else is returned unchanged for rethrowing.
   * @param {number} userId - The session's user.
   * @param {unknown} error - What the transaction threw.
   * @param {ProjectRepositoryLookup | null} lookup - The resolved repository, if any.
   * @returns {Promise<unknown>} The error to throw.
   */
  async #lostRace(userId: number, error: unknown, lookup: ProjectRepositoryLookup | null): Promise<unknown> {
    if (duplicateEntryIndex(error) !== PROJECT_REPOSITORY_INDEX || lookup === null) return error;

    const winner = await this.store.findLiveByRepository(userId, lookup.repositoryId);

    return winner === null ? error : projectRepositoryTaken(winner.uuid);
  }
}
