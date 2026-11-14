import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** The stored per-source statuses (`pending` is derived: no row). */
export const SOURCE_STATUSES = [
  'ok',
  'error',
  'invalid_credentials',
  'rate_limited',
  'page_cap_reached',
  'not_found',
] as const;

export type SourceStatus = typeof SOURCE_STATUSES[number];

/** Statuses that vouch for a source's rows (row statuses, link fill). */
export const OK_SOURCE_STATUSES: readonly SourceStatus[] = ['ok', 'page_cap_reached'];

/**
 * The status of the latest run of one source of one user. Owns table
 * `repositories_source_statuses` (see
 * `docs/agents/modules/repositories.md#repositories_source_statuses`).
 */
@Entity('repositories_source_statuses')
@Index('idx_repositories_source_statuses_user_id_source_key', ['userId', 'sourceKey'], { unique: true })
export class RepositorySourceStatus {
  @PrimaryGeneratedColumn()
    id!: number;

  @Column({ name: 'user_id', type: 'int' })
    userId!: number;

  @Column({ name: 'source_key', type: 'varchar', length: 32 })
    sourceKey!: string;

  @Column({ type: 'varchar', length: 32 })
    status!: SourceStatus;

  @Column({ name: 'synced_at', type: 'datetime' })
    syncedAt!: Date;

  @Column({ name: 'reset_at', type: 'datetime', nullable: true })
    resetAt!: Date | null;
}
