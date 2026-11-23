import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * The pending marker: one row per link with unsent local edits, and no payload (the job diffs
 * the issue against the base snapshot). Owns table `issues_pending_writes` (see
 * `docs/agents/modules/issues/data-model.md#issues_pending_writes-the-pending-marker`). `linkId` is a
 * logical FK only.
 */
@Entity('issues_pending_writes')
@Index('idx_issues_pending_writes_link_id', ['linkId'], { unique: true })
export class IssuePendingWrite {
  @PrimaryGeneratedColumn()
    id!: number;

  @Column({ name: 'link_id', type: 'int' })
    linkId!: number;

  @Column({ type: 'int' })
    revision!: number;

  @Column({ name: 'marked_at', type: 'datetime' })
    markedAt!: Date;

  @Column({ name: 'updated_at', type: 'datetime' })
    updatedAt!: Date;
}
