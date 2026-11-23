import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { escapeLike } from '../core/escape-like.js';
import { Issue, type IssueState } from './entities/issue.entity.js';
import type { ListIssuesInput } from './types/issues-api.types.js';

/** The values of a new issue row. */
export interface NewIssue {
  uuid: string;
  projectId: number;
  title: string;
  body: string | null;
  state: IssueState;
  createdAt: Date;
  updatedAt: Date;
}

/** The fields an edit may write. */
export interface IssueChanges {
  title?: string;
  body?: string | null;
  state?: IssueState;
}

/** A listing row: an issue without its `body`, which a page never reads. */
export type IssueListRecord = Omit<Issue, 'body'>;

/**
 * The TypeORM reads and writes of `issues` that the issues service shares. Every read is scoped
 * by the internal id of the project that `IssuesAccess` resolved; there is never a `user_id`
 * filter, since issues carry no owner. Methods take an optional `EntityManager` where they run
 * inside a transaction.
 */
@Injectable()
export class IssueStore {
  /**
   * @param {Repository<Issue>} issues - The default-connection issue repository.
   */
  constructor(@InjectRepository(Issue) private readonly issues: Repository<Issue>) {}

  /**
   * One page of the project's issues, newest first (`created_at DESC, id DESC`), and the total
   * matching the filter. `state = 'all'` adds no state filter. The search is a literal,
   * case-insensitive substring of the title: `%`, `_` and `\` are escaped. The `body` column is
   * never selected. A page past the end is empty.
   * @param {number} projectId - The project's internal id.
   * @param {ListIssuesInput} input - Page, page size, state filter and search.
   * @returns {Promise<{ issues: IssueListRecord[], total: number }>} The page and the total.
   */
  async page(projectId: number, input: ListIssuesInput): Promise<{ issues: IssueListRecord[]; total: number }> {
    const builder = this.issues.createQueryBuilder('issue')
      .select(['issue.id', 'issue.uuid', 'issue.projectId', 'issue.title', 'issue.state', 'issue.createdAt', 'issue.updatedAt'])
      .where('issue.project_id = :projectId', { projectId });

    if (input.state !== 'all') {
      builder.andWhere('issue.state = :state', { state: input.state });
    }

    if (input.search !== '') {
      builder.andWhere("issue.title LIKE :search ESCAPE '\\\\'", { search: `%${escapeLike(input.search)}%` });
    }

    const [issues, total] = await builder
      .orderBy('issue.created_at', 'DESC')
      .addOrderBy('issue.id', 'DESC')
      .skip((input.page - 1) * input.perPage)
      .take(input.perPage)
      .getManyAndCount();

    return { issues, total };
  }

  /**
   * How many issues the project has; runs under the project row lock, for the cap.
   * @param {EntityManager} manager - The creating transaction's manager.
   * @param {number} projectId - The project's internal id.
   * @returns {Promise<number>} The count.
   */
  countInProject(manager: EntityManager, projectId: number): Promise<number> {
    return manager.getRepository(Issue).countBy({ projectId });
  }

  /**
   * Inserts an issue.
   * @param {EntityManager} manager - The creating transaction's manager.
   * @param {NewIssue} values - The row's values (`uuid` comes from the service).
   * @returns {Promise<Issue>} The saved issue, with its internal id.
   */
  insert(manager: EntityManager, values: NewIssue): Promise<Issue> {
    const repository = manager.getRepository(Issue);

    return repository.save(repository.create(values));
  }

  /**
   * Writes an edit: only the changed fields, plus `updated_at`.
   * @param {EntityManager} manager - The editing transaction's manager.
   * @param {number} issueId - The issue's internal id.
   * @param {IssueChanges} changes - The fields to write.
   * @param {Date} updatedAt - The new `updated_at` (full millisecond precision).
   * @returns {Promise<void>}
   */
  async update(manager: EntityManager, issueId: number, changes: IssueChanges, updatedAt: Date): Promise<void> {
    await manager.getRepository(Issue).update({ id: issueId }, { ...changes, updatedAt });
  }

  /**
   * Locks an issue row (`FOR UPDATE`, the second step of the lock order) for the sync's commit.
   * @param {EntityManager} manager - The commit transaction's manager.
   * @param {number} issueId - The issue's internal id.
   * @returns {Promise<Issue | null>} The locked issue, or `null` when it is gone (its project or user was deleted).
   */
  lockById(manager: EntityManager, issueId: number): Promise<Issue | null> {
    return manager.getRepository(Issue).findOne({ where: { id: issueId }, lock: { mode: 'pessimistic_write' } });
  }

  /**
   * Resolves and locks the project's issues among the given public ids in one query
   * (`WHERE project_id = ? AND uuid IN (?) ORDER BY id FOR UPDATE`). The internal-id order keeps
   * two overlapping calls from deadlocking. Ids that are missing, or belong to another project,
   * are simply not returned.
   * @param {EntityManager} manager - The bulk transaction's manager.
   * @param {number} projectId - The project's internal id.
   * @param {string[]} uuids - The issues' public ids.
   * @returns {Promise<Issue[]>} The locked issues, by ascending internal id.
   */
  lockManyInProject(manager: EntityManager, projectId: number, uuids: string[]): Promise<Issue[]> {
    return manager.getRepository(Issue).createQueryBuilder('issue')
      .setLock('pessimistic_write')
      .where('issue.project_id = :projectId', { projectId })
      .andWhere('issue.uuid IN (:...uuids)', { uuids })
      .orderBy('issue.id', 'ASC')
      .getMany();
  }

  /**
   * Writes one `state` (and `updated_at`) on many issues in a single statement.
   * @param {EntityManager} manager - The bulk transaction's manager.
   * @param {number[]} issueIds - The internal ids of the issues to flip.
   * @param {IssueState} state - The target state.
   * @param {Date} updatedAt - The new `updated_at` (full millisecond precision).
   * @returns {Promise<void>}
   */
  async updateStateMany(manager: EntityManager, issueIds: number[], state: IssueState, updatedAt: Date): Promise<void> {
    if (issueIds.length === 0) return;

    await manager.getRepository(Issue).update({ id: In(issueIds) }, { state, updatedAt });
  }

  /**
   * Deletes an issue.
   * @param {EntityManager} manager - The deleting transaction's manager.
   * @param {number} issueId - The issue's internal id.
   * @returns {Promise<void>}
   */
  async delete(manager: EntityManager, issueId: number): Promise<void> {
    await manager.getRepository(Issue).delete({ id: issueId });
  }
}
