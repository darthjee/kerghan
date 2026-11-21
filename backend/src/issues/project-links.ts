import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

const PROJECT_ISSUE_IDS = 'SELECT id FROM issues WHERE project_id = ?';
const PROJECT_LINK_IDS = `SELECT id FROM issues_github_links WHERE issue_id IN (${PROJECT_ISSUE_IDS})`;

/**
 * The queries over a project's issues, links and markers that its repository change and its
 * deletion need (`docs/agents/specs/issues/model.md#cleanup`). Every one is scoped by the
 * project's internal id and runs inside the caller's transaction, after the caller took the
 * project row lock (the first lock of the order: projects, issues, links, markers).
 */
@Injectable()
export class ProjectLinks {
  /**
   * How many of the project's issues are linked to a GitHub issue.
   * @param {EntityManager} manager - The caller's transaction.
   * @param {number} projectId - The project's internal id.
   * @returns {Promise<number>} The number of links.
   */
  async count(manager: EntityManager, projectId: number): Promise<number> {
    const rows: Array<{ total: string | number }> = await manager.query(
      `SELECT COUNT(*) AS total FROM issues_github_links WHERE issue_id IN (${PROJECT_ISSUE_IDS})`,
      [projectId],
    );

    return Number(rows[0].total);
  }

  /**
   * Hard-deletes everything under a project, counting the unsent edits first. Takes the locks in
   * the module's order (issues, then links, then markers) and deletes children first: markers,
   * then links, then issues. The project row itself is left to the caller.
   * @param {EntityManager} manager - The caller's transaction.
   * @param {number} projectId - The project's internal id.
   * @returns {Promise<number>} The number of issues that had a pending marker, counted before the delete.
   */
  async purge(manager: EntityManager, projectId: number): Promise<number> {
    await manager.query(`${PROJECT_ISSUE_IDS} FOR UPDATE`, [projectId]);
    await manager.query(`${PROJECT_LINK_IDS} FOR UPDATE`, [projectId]);
    await manager.query(`SELECT id FROM issues_pending_writes WHERE link_id IN (${PROJECT_LINK_IDS}) FOR UPDATE`, [projectId]);

    const unsent = await this.#unsentIssueCount(manager, projectId);

    await manager.query(`DELETE FROM issues_pending_writes WHERE link_id IN (${PROJECT_LINK_IDS})`, [projectId]);
    await manager.query(`DELETE FROM issues_github_links WHERE issue_id IN (${PROJECT_ISSUE_IDS})`, [projectId]);
    await manager.query('DELETE FROM issues WHERE project_id = ?', [projectId]);

    return unsent;
  }

  /**
   * @param {EntityManager} manager - The caller's transaction.
   * @param {number} projectId - The project's internal id.
   * @returns {Promise<number>} The number of the project's issues whose link has a pending marker.
   */
  async #unsentIssueCount(manager: EntityManager, projectId: number): Promise<number> {
    const rows: Array<{ total: string | number }> = await manager.query(
      'SELECT COUNT(DISTINCT link.issue_id) AS total FROM issues_pending_writes marker'
      + ` JOIN issues_github_links link ON link.id = marker.link_id WHERE link.issue_id IN (${PROJECT_ISSUE_IDS})`,
      [projectId],
    );

    return Number(rows[0].total);
  }
}
