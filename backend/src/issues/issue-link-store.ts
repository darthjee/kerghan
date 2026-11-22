import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { IssueGithubLink } from './entities/issue-github-link.entity.js';

/** The values of a new link: it starts `linked` with its base snapshot (`status_reason` is `NULL`). */
export interface NewLink {
  userId: number;
  issueId: number;
  githubIssueId: number;
  githubNumber: number;
  baseTitle: string;
  baseBody: string | null;
  baseState: string;
  githubUpdatedAt: Date;
  etag: string | null;
  /** The instant of `last_synced_at`, `created_at` and `updated_at` (whole seconds). */
  now: Date;
}

/** The existing link of a GitHub issue, with the public ids of its issue and project. */
export interface ExistingLink {
  projectUuid: string;
  issueUuid: string;
}

/**
 * The queries of `issues_github_links` that link creation and unlink share. Every method runs in
 * the caller's transaction, after the caller took the earlier locks of the order (projects, issues).
 */
@Injectable()
export class IssueLinkStore {
  /**
   * The link of an issue, or `null` when it has none.
   * @param {EntityManager} manager - The transaction's manager.
   * @param {number} issueId - The issue's internal id.
   * @param {{ lock: boolean }} options - `lock` takes `FOR UPDATE` (the third step of the lock order).
   * @returns {Promise<IssueGithubLink | null>} The link row.
   */
  findByIssue(manager: EntityManager, issueId: number, options: { lock: boolean }): Promise<IssueGithubLink | null> {
    return manager.getRepository(IssueGithubLink).findOne({
      where: { issueId },
      ...(options.lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
  }

  /**
   * The existing link of this user to a GitHub issue, with its issue and project uuids (the meta of
   * `GITHUB_ISSUE_ALREADY_LINKED`). Never reads another user's links.
   * @param {EntityManager} manager - The transaction's manager.
   * @param {number} userId - The project owner.
   * @param {number} githubIssueId - GitHub's issue id.
   * @returns {Promise<ExistingLink | null>} The link's public ids, or `null` when there is none.
   */
  async findByGithubIssue(manager: EntityManager, userId: number, githubIssueId: number): Promise<ExistingLink | null> {
    const rows: Array<{ project_uuid: string; issue_uuid: string }> = await manager.query(
      'SELECT p.uuid AS project_uuid, i.uuid AS issue_uuid FROM issues_github_links l '
      + 'JOIN issues i ON i.id = l.issue_id JOIN issues_projects p ON p.id = i.project_id '
      + 'WHERE l.user_id = ? AND l.github_issue_id = ? LIMIT 1',
      [userId, githubIssueId],
    );

    return rows.length === 0 ? null : { projectUuid: rows[0].project_uuid, issueUuid: rows[0].issue_uuid };
  }

  /**
   * Inserts a `linked` link with its base snapshot. A violation of a unique index surfaces as the
   * driver's duplicate-entry error, for the caller to classify.
   * @param {EntityManager} manager - The transaction's manager.
   * @param {NewLink} values - The link's values.
   * @returns {Promise<IssueGithubLink>} The saved link, with its internal id.
   */
  insert(manager: EntityManager, values: NewLink): Promise<IssueGithubLink> {
    const repository = manager.getRepository(IssueGithubLink);

    return repository.save(repository.create({
      userId: values.userId,
      issueId: values.issueId,
      githubIssueId: values.githubIssueId,
      githubNumber: values.githubNumber,
      status: 'linked',
      statusReason: null,
      baseTitle: values.baseTitle,
      baseBody: values.baseBody,
      baseState: values.baseState,
      githubUpdatedAt: values.githubUpdatedAt,
      lastSyncedAt: values.now,
      etag: values.etag,
      createdAt: values.now,
      updatedAt: values.now,
    }));
  }

  /**
   * Deletes a link.
   * @param {EntityManager} manager - The transaction's manager.
   * @param {number} linkId - The link's internal id.
   * @returns {Promise<void>}
   */
  async delete(manager: EntityManager, linkId: number): Promise<void> {
    await manager.getRepository(IssueGithubLink).delete({ id: linkId });
  }
}
