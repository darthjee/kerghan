import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Which step of the GitHub App flow a state row belongs to. */
export type GithubAppStateStage = 'redirect' | 'select';

/** What a started GitHub App flow will do once verified. */
export type GithubAppStatePurpose = 'create' | 'replace';

/**
 * A server-side, single-use record of one started GitHub App flow (see
 * `docs/agents/specs/integrations/types/github-app.md#state`). Owns table
 * `integrations_github_app_states`. `userId` is a logical foreign key (no
 * physical FK, no cross-module JOIN) into `auth_users`. Only the SHA-256 of
 * the `state` secret is stored. A `select` row also records the result of
 * the ownership check: the candidate installation ids and the verifying
 * GitHub login (`verified_by`, stored as `metadata.verifiedBy` on select).
 */
@Entity('integrations_github_app_states')
export class IntegrationGithubAppState {
  @PrimaryGeneratedColumn()
    id!: number;

  @Index('idx_integrations_github_app_states_uuid', { unique: true })
  @Column({ type: 'char', length: 36 })
    uuid!: string;

  @Index('idx_integrations_github_app_states_user_id')
  @Column({ name: 'user_id', type: 'int' })
    userId!: number;

  @Column({ name: 'secret_hash', type: 'char', length: 64 })
    secretHash!: string;

  @Column({ type: 'varchar', length: 16 })
    stage!: GithubAppStateStage;

  @Column({ type: 'varchar', length: 16 })
    purpose!: GithubAppStatePurpose;

  @Column({ type: 'varchar', length: 100, nullable: true })
    label!: string | null;

  @Column({ name: 'integration_uuid', type: 'char', length: 36, nullable: true })
    integrationUuid!: string | null;

  @Column({ name: 'candidate_installation_ids', type: 'json', nullable: true })
    candidateInstallationIds!: number[] | null;

  @Column({ name: 'verified_by', type: 'varchar', length: 39, nullable: true })
    verifiedBy!: string | null;

  @Index('idx_integrations_github_app_states_expires_at')
  @Column({ name: 'expires_at', type: 'datetime' })
    expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;
}
