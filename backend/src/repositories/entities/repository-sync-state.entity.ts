import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** The two lock states of a user's sync. */
export type SyncLockState = 'idle' | 'syncing';

/**
 * One row per user, keyed by `user_id`: the per-user sync lock, its lease,
 * the cooldown anchor and the handle the stored `handle` rows belong to. Owns
 * table `repositories_sync_states` (see
 * `docs/agents/specs/repos/model.md#repositories_sync_states`).
 */
@Entity('repositories_sync_states')
export class RepositorySyncState {
  @PrimaryColumn({ name: 'user_id', type: 'int' })
    userId!: number;

  @Column({ type: 'varchar', length: 16 })
    state!: SyncLockState;

  @Column({ name: 'run_id', type: 'char', length: 36, nullable: true })
    runId!: string | null;

  @Column({ name: 'last_started_at', type: 'datetime', nullable: true })
    lastStartedAt!: Date | null;

  @Column({ name: 'heartbeat_at', type: 'datetime', nullable: true })
    heartbeatAt!: Date | null;

  @Column({ name: 'last_synced_at', type: 'datetime', nullable: true })
    lastSyncedAt!: Date | null;

  @Column({ type: 'varchar', length: 39, nullable: true })
    handle!: string | null;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
