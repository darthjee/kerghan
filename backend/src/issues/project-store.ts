import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { IssuesProject } from './entities/issues-project.entity.js';

/** The values of a new project row (the store adds nothing but the live `deleted_token = 0`). */
export interface NewProject {
  uuid: string;
  userId: number;
  name: string;
  description: string | null;
  repositoryId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The TypeORM reads and writes of `issues_projects` that the project services share. Every read
 * is scoped by `user_id` and by `deleted_token = 0` (live projects only), so a tombstone never
 * counts toward a name, a repository or the cap.
 */
@Injectable()
export class ProjectStore {
  /**
   * @param {Repository<IssuesProject>} projects - The default-connection project repository.
   */
  constructor(@InjectRepository(IssuesProject) private readonly projects: Repository<IssuesProject>) {}

  /**
   * The user's live project on a repository, if any.
   * @param {number} userId - The owner.
   * @param {number} repositoryId - The repository's internal id.
   * @param {EntityManager} [manager] - The transaction manager to read through.
   * @returns {Promise<IssuesProject | null>} The project, or `null`.
   */
  findLiveByRepository(userId: number, repositoryId: number, manager?: EntityManager): Promise<IssuesProject | null> {
    return this.#repository(manager).findOneBy({ userId, repositoryId, deletedToken: 0 });
  }

  /**
   * The user's live project with a name. The column's `utf8mb4_0900_ai_ci` collation compares it
   * case-insensitively, as the unique index does.
   * @param {number} userId - The owner.
   * @param {string} name - The name.
   * @param {EntityManager} [manager] - The transaction manager to read through.
   * @returns {Promise<IssuesProject | null>} The project, or `null`.
   */
  findLiveByName(userId: number, name: string, manager?: EntityManager): Promise<IssuesProject | null> {
    return this.#repository(manager).findOneBy({ userId, name, deletedToken: 0 });
  }

  /**
   * How many live projects the user has.
   * @param {number} userId - The owner.
   * @param {EntityManager} [manager] - The transaction manager to read through.
   * @returns {Promise<number>} The count.
   */
  countLive(userId: number, manager?: EntityManager): Promise<number> {
    return this.#repository(manager).countBy({ userId, deletedToken: 0 });
  }

  /**
   * Inserts a live project.
   * @param {EntityManager} manager - The creating transaction's manager.
   * @param {NewProject} values - The row's values.
   * @returns {Promise<IssuesProject>} The saved project, with its internal id.
   */
  insert(manager: EntityManager, values: NewProject): Promise<IssuesProject> {
    const repository = manager.getRepository(IssuesProject);

    return repository.save(repository.create({ ...values, deletedAt: null, deletedToken: 0 }));
  }

  /**
   * @param {EntityManager} [manager] - A transaction manager.
   * @returns {Repository<IssuesProject>} The manager's repository, or the default one.
   */
  #repository(manager?: EntityManager): Repository<IssuesProject> {
    return manager ? manager.getRepository(IssuesProject) : this.projects;
  }
}
