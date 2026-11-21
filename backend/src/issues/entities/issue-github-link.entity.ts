import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Maps MySQL `bigint` (returned as a string by the driver) to a JS number. */
export const BIGINT_TO_NUMBER = {
  from: (value: string | number | null): number | null => (value === null ? null : Number(value)),
  to: (value: number | null): number | null => value,
};

/**
 * The optional one to one link of an issue to a GitHub issue, with the base snapshot the sync
 * reconciles against. Owns table `issues_github_links` (see
 * `docs/agents/specs/issues/model.md#issues_github_links`). `userId` serves the uniqueness rule
 * and user cleanup, never authorization. `issueId` is a logical FK only.
 */
@Entity('issues_github_links')
@Index('idx_issues_github_links_user_id_github_issue_id', ['userId', 'githubIssueId'], { unique: true })
@Index('idx_issues_github_links_issue_id', ['issueId'], { unique: true })
export class IssueGithubLink {
  @PrimaryGeneratedColumn()
    id!: number;

  @Column({ name: 'user_id', type: 'int' })
    userId!: number;

  @Column({ name: 'issue_id', type: 'int' })
    issueId!: number;

  @Column({ name: 'github_issue_id', type: 'bigint', transformer: BIGINT_TO_NUMBER })
    githubIssueId!: number;

  @Column({ name: 'github_number', type: 'int' })
    githubNumber!: number;

  @Column({ type: 'varchar', length: 32 })
    status!: string;

  @Column({ name: 'status_reason', type: 'varchar', length: 32, nullable: true })
    statusReason!: string | null;

  @Column({ name: 'base_title', type: 'varchar', length: 256 })
    baseTitle!: string;

  @Column({ name: 'base_body', type: 'mediumtext', nullable: true })
    baseBody!: string | null;

  @Column({ name: 'base_state', type: 'varchar', length: 16 })
    baseState!: string;

  @Column({ name: 'github_updated_at', type: 'datetime', nullable: true })
    githubUpdatedAt!: Date | null;

  @Column({ name: 'last_synced_at', type: 'datetime', nullable: true })
    lastSyncedAt!: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
    etag!: string | null;

  @Column({ name: 'created_at', type: 'datetime' })
    createdAt!: Date;

  @Column({ name: 'updated_at', type: 'datetime' })
    updatedAt!: Date;
}
