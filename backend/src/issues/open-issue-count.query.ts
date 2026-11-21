import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Issue } from './entities/issue.entity.js';

/**
 * The open-issue counts of the project object (`docs/agents/specs/issues/api/projects.md#open-issue-count`):
 * the issues whose stored local `state` is `open`, whatever their link state, computed at read
 * time (no stored column, no cache) over `idx_issues_project_id_state_created_at`.
 */
@Injectable()
export class ProjectOpenIssueCounts {
  /**
   * @param {Repository<Issue>} issues - The default-connection issue repository.
   */
  constructor(@InjectRepository(Issue) private readonly issues: Repository<Issue>) {}

  /**
   * The counts of a whole listing page, in exactly one grouped query (never one per project); an
   * empty page runs none. Projects absent from the result read `0`.
   * @param {number[]} projectIds - The internal ids of the page's projects.
   * @returns {Promise<Map<number, number>>} The count of every given id.
   */
  async forPage(projectIds: number[]): Promise<Map<number, number>> {
    const counts = new Map<number, number>(projectIds.map((id) => [id, 0]));

    if (projectIds.length === 0) return counts;

    const rows: Array<{ projectId: number; total: string | number }> = await this.issues
      .createQueryBuilder('issue')
      .select('issue.project_id', 'projectId')
      .addSelect('COUNT(*)', 'total')
      .where('issue.project_id IN (:...projectIds)', { projectIds })
      .andWhere('issue.state = :state', { state: 'open' })
      .groupBy('issue.project_id')
      .getRawMany();

    for (const row of rows) counts.set(Number(row.projectId), Number(row.total));

    return counts;
  }

  /**
   * The count of one project, in one indexed `COUNT`.
   * @param {number} projectId - The project's internal id.
   * @param {EntityManager} [manager] - The transaction manager to read through.
   * @returns {Promise<number>} The number of its open issues.
   */
  forProject(projectId: number, manager?: EntityManager): Promise<number> {
    const repository = manager ? manager.getRepository(Issue) : this.issues;

    return repository.count({ where: { projectId, state: 'open' } });
  }
}
