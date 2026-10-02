import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * The per-user failure cool-off for creating an integration and replacing
 * its credential, one row per user (see `IntegrationCredentialLockoutService`).
 * Owns table `integrations_credential_lockouts`. Mirrors
 * `AccountEditLockout`: `userId` is a logical foreign key (no physical FK,
 * no cross-module JOIN) into `auth_users`, and unique — the row is upserted
 * in place rather than appended.
 */
@Entity('integrations_credential_lockouts')
export class IntegrationCredentialLockout {
  @PrimaryGeneratedColumn()
    id!: number;

  @Index('idx_integrations_credential_lockouts_user_id', { unique: true })
  @Column({ name: 'user_id', type: 'int' })
    userId!: number;

  @Column({ name: 'failed_attempts', type: 'int', default: 0 })
    failedAttempts!: number;

  @Column({ name: 'locked_until', type: 'datetime', nullable: true })
    lockedUntil!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
