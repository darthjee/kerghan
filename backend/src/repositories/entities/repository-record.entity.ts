import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Maps MySQL `bigint` (returned as a string by the driver) to a JS number. */
export const BIGINT_TO_NUMBER = {
  from: (value: string | number | null): number | null => (value === null ? null : Number(value)),
  to: (value: number | null): number | null => value,
};

/**
 * One row per (user, GitHub repository) seen in a sync: the persisted
 * snapshot of the repo, and whether the user added it (`added_at`). Owns table
 * `repositories` (see `docs/agents/modules/repositories.md#repositories`).
 * `userId` and `integrationId` are logical FKs only: no relation, no join.
 */
@Entity('repositories')
@Index('idx_repositories_user_id_github_id', ['userId', 'githubId'], { unique: true })
@Index('idx_repositories_user_id_added_at', ['userId', 'addedAt'])
@Index('idx_repositories_user_id_owner_name', ['userId', 'owner', 'name'])
@Index('idx_repositories_user_id_integration_id', ['userId', 'integrationId'])
export class RepositoryRecord {
  @PrimaryGeneratedColumn()
    id!: number;

  @Column({ name: 'user_id', type: 'int' })
    userId!: number;

  @Column({ name: 'github_id', type: 'bigint', transformer: BIGINT_TO_NUMBER })
    githubId!: number;

  @Column({ type: 'varchar', length: 39 })
    owner!: string;

  @Column({ type: 'varchar', length: 100 })
    name!: string;

  @Column({ type: 'boolean' })
    private!: boolean;

  @Column({ name: 'added_at', type: 'datetime', nullable: true })
    addedAt!: Date | null;

  @Column({ name: 'integration_id', type: 'int', nullable: true })
    integrationId!: number | null;

  @Column({ name: 'last_seen_at', type: 'datetime' })
    lastSeenAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
