import { Injectable } from '@nestjs/common';
import { Not, type EntityManager } from 'typeorm';
import { IssueGithubLink } from './entities/issue-github-link.entity.js';
import type { IssueValues } from './github-values.js';
import { IssueMarkers } from './issue-markers.js';

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

/** The reasons of a `sync_failed` link (`docs/agents/specs/issues/sync.md#retries-and-sync_failed`). */
export type SyncFailureReason = 'retries_exhausted' | 'no_credential' | 'credential_invalid' | 'forbidden';

/** The reasons of a `gone` link. */
export type GoneReason = 'deleted' | 'moved';

/** What a reconcile's commit writes on the link (`docs/agents/specs/issues/sync.md#reconcile`, step 5). */
export interface SyncWrite {
  /** The fields whose base snapshot takes a value (the pushed ones and, when applied, the pulled ones). */
  base: Partial<IssueValues>;
  /** The `PATCH` response's `updated_at`, or the `GET`'s when nothing was pushed (the stored one after a `304`). */
  githubUpdatedAt: Date | null;
  /** Stored from a `200` `GET`; `null` after a `PATCH`; the stored one again after a `304`. */
  etag: string | null;
  /** Leaves `sync_failed`: back to `linked` with no reason. Not set while an unsent write remains. */
  clearFailure: boolean;
  /** The instant of `last_synced_at` and `updated_at` (whole seconds). */
  now: Date;
}

/** One link of a project, for the project refresh (T3). */
export interface ProjectLinkRow {
  linkId: number;
  lastSyncedAt: Date | null;
  hasMarker: boolean;
}

/**
 * The queries of `issues_github_links` that link creation, unlink and the sync share. Every write
 * runs in the caller's transaction, after the caller took the earlier locks of the order (projects,
 * issues).
 */
@Injectable()
export class IssueLinkStore {
  /**
   * @param {IssueMarkers} markers - Discards the marker when a link turns `gone`.
   */
  constructor(private readonly markers: IssueMarkers) {}

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

  /**
   * Locks the link (`FOR UPDATE`, the third step of the lock order) for the reconcile's commit. The
   * commit applies only while the link still exists and is not `gone` (E1 race, E32).
   * @param {EntityManager} manager - The commit transaction's manager.
   * @param {number} linkId - The link's internal id.
   * @returns {Promise<IssueGithubLink | null>} The locked link, or `null` when it is missing or `gone`.
   */
  async lockForCommit(manager: EntityManager, linkId: number): Promise<IssueGithubLink | null> {
    const link = await manager.getRepository(IssueGithubLink).findOne({
      where: { id: linkId },
      lock: { mode: 'pessimistic_write' },
    });

    return link === null || link.status === 'gone' ? null : link;
  }

  /**
   * Writes the commit's effects on a link that is not `gone`: the base of the given fields,
   * `github_updated_at`, the `etag`, `last_synced_at` and `updated_at`; with `clearFailure` it also
   * goes back to `linked` with no reason. A `gone` or missing link is left alone.
   * @param {EntityManager} manager - The commit transaction's manager.
   * @param {number} linkId - The link's internal id.
   * @param {SyncWrite} write - The values to write.
   * @returns {Promise<boolean>} `true` when the link was written.
   */
  async recordSync(manager: EntityManager, linkId: number, write: SyncWrite): Promise<boolean> {
    const result = await manager.getRepository(IssueGithubLink).update(
      { id: linkId, status: Not('gone') },
      {
        ...(write.base.title === undefined ? {} : { baseTitle: write.base.title }),
        ...('body' in write.base ? { baseBody: write.base.body ?? null } : {}),
        ...(write.base.state === undefined ? {} : { baseState: write.base.state }),
        githubUpdatedAt: write.githubUpdatedAt,
        etag: write.etag,
        lastSyncedAt: write.now,
        updatedAt: write.now,
        ...(write.clearFailure ? { status: 'linked', statusReason: null } : {}),
      },
    );

    return (result.affected ?? 0) > 0;
  }

  /**
   * Sets the link `sync_failed` with a reason; the latest reason overwrites an earlier one. A `gone`
   * or missing link is left alone. One guarded `UPDATE`, so it needs no earlier lock.
   * @param {EntityManager} manager - The transaction's manager.
   * @param {number} linkId - The link's internal id.
   * @param {SyncFailureReason} reason - Why the sync failed.
   * @param {Date} now - The instant of `updated_at` (whole seconds).
   * @returns {Promise<boolean>} `true` when the link was written.
   */
  async markSyncFailed(manager: EntityManager, linkId: number, reason: SyncFailureReason, now: Date): Promise<boolean> {
    const result = await manager.getRepository(IssueGithubLink).update(
      { id: linkId, status: Not('gone') },
      { status: 'sync_failed', statusReason: reason, updatedAt: now },
    );

    return (result.affected ?? 0) > 0;
  }

  /**
   * Sets the link back to `linked` with no reason (the retry sync resets a failure at once). A
   * `gone` or missing link is left alone.
   * @param {EntityManager} manager - The transaction's manager.
   * @param {number} linkId - The link's internal id.
   * @param {Date} now - The instant of `updated_at` (whole seconds).
   * @returns {Promise<boolean>} `true` when the link was written.
   */
  async markLinked(manager: EntityManager, linkId: number, now: Date): Promise<boolean> {
    const result = await manager.getRepository(IssueGithubLink).update(
      { id: linkId, status: Not('gone') },
      { status: 'linked', statusReason: null, updatedAt: now },
    );

    return (result.affected ?? 0) > 0;
  }

  /**
   * Turns the link `gone` and discards its marker in the same transaction (E1): a gone link gets
   * no push and no refresh, and is left only by unlinking. Locks the link, then the marker (the
   * lock order). An already `gone` or missing link is left alone.
   * @param {EntityManager} manager - The transaction's manager.
   * @param {number} linkId - The link's internal id.
   * @param {GoneReason} reason - `deleted` (`404` or `410`) or `moved` (a transfer).
   * @param {Date} now - The instant of `updated_at` (whole seconds).
   * @returns {Promise<boolean>} `true` when the link was turned `gone` by this call.
   */
  async markGone(manager: EntityManager, linkId: number, reason: GoneReason, now: Date): Promise<boolean> {
    const link = await this.lockForCommit(manager, linkId);

    if (link === null) return false;

    await manager.getRepository(IssueGithubLink).update({ id: linkId }, { status: 'gone', statusReason: reason, updatedAt: now });
    await this.markers.deleteForLink(manager, linkId);

    return true;
  }

  /**
   * The non-`gone` links of a project's issues for the project refresh (T3), oldest
   * `last_synced_at` first with a never-synced link (`NULL`) before any, ties by link id, and
   * whether each has a marker. Reads the links of the project only; `gone` links stay out.
   * @param {EntityManager} manager - The manager to read through.
   * @param {number} projectId - The project's internal id.
   * @returns {Promise<ProjectLinkRow[]>} The links in refresh order.
   */
  async listSyncableByProject(manager: EntityManager, projectId: number): Promise<ProjectLinkRow[]> {
    const rows: Array<{ id: number; last_synced_at: Date | null; has_marker: number | string }> = await manager.query(
      'SELECT l.id AS id, l.last_synced_at AS last_synced_at, '
      + 'EXISTS (SELECT 1 FROM issues_pending_writes w WHERE w.link_id = l.id) AS has_marker '
      + 'FROM issues_github_links l JOIN issues i ON i.id = l.issue_id '
      + "WHERE i.project_id = ? AND l.status <> 'gone' "
      + 'ORDER BY (l.last_synced_at IS NULL) DESC, l.last_synced_at ASC, l.id ASC',
      [projectId],
    );

    return rows.map((row) => ({ linkId: row.id, lastSyncedAt: row.last_synced_at, hasMarker: Number(row.has_marker) === 1 }));
  }
}
