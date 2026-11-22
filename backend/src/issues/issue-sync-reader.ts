import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { normalizeBody } from './dto/issue-fields.js';
import type { IssueState } from './entities/issue.entity.js';
import type { IssueValues } from './github-values.js';
import { IssueMarkers, type MarkerState } from './issue-markers.js';

/** Everything a reconcile reads before it calls GitHub, as one consistent snapshot. */
export interface SyncSubject {
  linkId: number;
  /** The project owner: whose integrations the job uses, whoever triggered it. */
  userId: number;
  issueId: number;
  projectId: number;
  /** The project's repository, or `null` when it has none (then nothing can sync). */
  repositoryId: number | null;
  githubNumber: number;
  /** The stored `ETag` of the last `200` `GET`. */
  etag: string | null;
  githubUpdatedAt: Date | null;
  /** The issue's current values (L). */
  local: IssueValues;
  /** When the issue was last edited locally (the `Tm` fallback of a link with no marker). */
  localUpdatedAt: Date;
  /** The base snapshot (B). */
  base: IssueValues;
  /** The pending marker (revision `R`), or `null` for an inbound refresh. */
  marker: MarkerState | null;
}

interface SubjectRow {
  link_id: number;
  user_id: number;
  issue_id: number;
  project_id: number;
  repository_id: number | null;
  github_number: number;
  etag: string | null;
  github_updated_at: Date | null;
  base_title: string;
  base_body: string | null;
  base_state: IssueState;
  title: string;
  body: string | null;
  state: IssueState;
  issue_updated_at: Date;
}

/**
 * Guard 1 of the reconcile and the read of its marker, the local values and the base
 * (`docs/agents/specs/issues/sync.md#reconcile`, step 1). Both reads run in one transaction, so the
 * marker's revision and the issue's values are one snapshot: an edit commits the issue and its
 * marker together, and the revision this reads always matches the values it read.
 */
@Injectable()
export class IssueSyncReader {
  /**
   * @param {DataSource} dataSource - Opens the read transaction.
   * @param {IssueMarkers} markers - Reads the marker.
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly markers: IssueMarkers,
  ) {}

  /**
   * @param {number} linkId - The link's internal id.
   * @returns {Promise<SyncSubject | null>} The snapshot, or `null` when the link does not exist, is
   *   `gone` or its project is deleted (a deleted user's project has no issues left either): a
   *   silent no-op (E1, E32, E40).
   */
  load(linkId: number): Promise<SyncSubject | null> {
    return this.dataSource.transaction(async (manager) => {
      const rows: SubjectRow[] = await manager.query(
        'SELECT l.id AS link_id, l.user_id, l.issue_id, l.github_number, l.etag, l.github_updated_at, '
        + 'l.base_title, l.base_body, l.base_state, i.title, i.body, i.state, i.updated_at AS issue_updated_at, '
        + 'p.id AS project_id, p.repository_id '
        + 'FROM issues_github_links l JOIN issues i ON i.id = l.issue_id JOIN issues_projects p ON p.id = i.project_id '
        + "WHERE l.id = ? AND l.status <> 'gone' AND p.deleted_token = 0",
        [linkId],
      );

      if (rows.length === 0) return null;

      const row = rows[0];

      return {
        linkId: row.link_id,
        userId: row.user_id,
        issueId: row.issue_id,
        projectId: row.project_id,
        repositoryId: row.repository_id,
        githubNumber: row.github_number,
        etag: row.etag,
        githubUpdatedAt: row.github_updated_at,
        local: { title: row.title, body: normalizeBody(row.body), state: row.state },
        localUpdatedAt: row.issue_updated_at,
        base: { title: row.base_title, body: normalizeBody(row.base_body), state: row.base_state },
        marker: await this.markers.findRevision(manager, linkId, { lock: false }),
      };
    });
  }
}
