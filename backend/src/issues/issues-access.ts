import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Issue } from './entities/issue.entity.js';
import { IssuesProject } from './entities/issues-project.entity.js';
import { issueNotFound, projectNotFound } from './issues-http-errors.js';

/** Options of the access lookups. */
export interface AccessOptions {
  /** Take `FOR UPDATE` on the row (needs a transaction `manager`). */
  lock?: boolean;
}

/**
 * The single access check of the module: the one place that answers "this user's live project,
 * or 404" (`docs/agents/specs/issues/security.md`). Issues carry no owner: they derive access
 * from their project, so no other code filters by `user_id` for access. The project lock taken
 * here is the first lock of the lock order (projects, issues, links, markers).
 */
@Injectable()
export class IssuesAccess {
  /**
   * @param {Repository<IssuesProject>} projects - The default-connection project repository.
   * @param {Repository<Issue>} issues - The default-connection issue repository.
   */
  constructor(
    @InjectRepository(IssuesProject) private readonly projects: Repository<IssuesProject>,
    @InjectRepository(Issue) private readonly issues: Repository<Issue>,
  ) {}

  /**
   * Finds the user's live project by its public uuid. A missing, another user's and a deleted
   * project all answer the same `404`.
   * @param {number} userId - The authenticated user's id.
   * @param {string} projectUuid - The project's public id.
   * @param {EntityManager} [manager] - The transaction manager to read through.
   * @param {AccessOptions} [options] - `lock` takes `FOR UPDATE` on the project row.
   * @returns {Promise<IssuesProject>} The live project.
   * @throws {NotFoundException} `NOT_FOUND` when no live project of this user has that uuid.
   */
  async findLiveProject(
    userId: number,
    projectUuid: string,
    manager?: EntityManager,
    options: AccessOptions = {},
  ): Promise<IssuesProject> {
    const repository = manager ? manager.getRepository(IssuesProject) : this.projects;
    const project = await repository.findOne({
      where: { uuid: projectUuid, userId, deletedToken: 0 },
      ...(options.lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });

    if (!project) {
      throw projectNotFound();
    }

    return project;
  }

  /**
   * Finds an issue by its public uuid, only inside the already resolved `project`.
   * @param {IssuesProject} project - The project returned by `findLiveProject`.
   * @param {string} issueUuid - The issue's public id.
   * @param {EntityManager} [manager] - The transaction manager to read through.
   * @param {AccessOptions} [options] - `lock` takes `FOR UPDATE` on the issue row.
   * @returns {Promise<Issue>} The issue.
   * @throws {NotFoundException} `NOT_FOUND` when the issue is missing or in another project.
   */
  async findIssueInProject(
    project: IssuesProject,
    issueUuid: string,
    manager?: EntityManager,
    options: AccessOptions = {},
  ): Promise<Issue> {
    const repository = manager ? manager.getRepository(Issue) : this.issues;
    const issue = await repository.findOne({
      where: { uuid: issueUuid, projectId: project.id },
      ...(options.lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });

    if (!issue) {
      throw issueNotFound();
    }

    return issue;
  }
}
