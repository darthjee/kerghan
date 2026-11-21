import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { escapeLike } from '../core/escape-like.js';
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

/** One page of the listing: its filter and bounds. */
export interface ProjectPageQuery {
  /** 1-based page. */
  page: number;
  perPage: number;
  /** Trimmed literal substring of the name; empty means no search. */
  search: string;
}

/** The fields an edit may write. */
export interface ProjectChanges {
  name?: string;
  description?: string | null;
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
   * One page of the user's live projects, sorted by name (the column's case-insensitive collation;
   * stable, since names are unique among live projects), and the total matching the search. The
   * search is a literal substring: `%`, `_` and `\` are escaped. A page past the end is empty.
   * @param {number} userId - The owner (the listing's own scope).
   * @param {ProjectPageQuery} query - Page, page size and search.
   * @returns {Promise<{ projects: IssuesProject[], total: number }>} The page and the total.
   */
  async page(userId: number, query: ProjectPageQuery): Promise<{ projects: IssuesProject[]; total: number }> {
    const builder = this.projects.createQueryBuilder('project')
      .where('project.user_id = :userId AND project.deleted_token = 0', { userId });

    if (query.search !== '') {
      builder.andWhere("project.name LIKE :search ESCAPE '\\\\'", { search: `%${escapeLike(query.search)}%` });
    }

    const [projects, total] = await builder
      .orderBy('project.name', 'ASC')
      .skip((query.page - 1) * query.perPage)
      .take(query.perPage)
      .getManyAndCount();

    return { projects, total };
  }

  /**
   * Writes an edit to a live project. The `deleted_token = 0` guard keeps a project deleted in
   * the meantime untouched.
   * @param {number} projectId - The project's internal id.
   * @param {ProjectChanges} changes - The fields to write.
   * @param {Date} updatedAt - The new `updated_at`.
   * @returns {Promise<boolean>} `false` when no live row matched (the project was deleted meanwhile).
   */
  async update(projectId: number, changes: ProjectChanges, updatedAt: Date): Promise<boolean> {
    const result = await this.projects.update({ id: projectId, deletedToken: 0 }, { ...changes, updatedAt });

    return (result.affected ?? 0) > 0;
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
