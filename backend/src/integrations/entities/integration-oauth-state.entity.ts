import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** What a started OAuth App flow will do on callback. */
export type OauthStatePurpose = 'create' | 'replace';

/**
 * A server-side, single-use record of one started OAuth App redirect flow
 * (see `docs/agents/specs/integrations/types/oauth-app.md#state`). Owns table
 * `integrations_oauth_states`. `userId` is a logical foreign key (no
 * physical FK, no cross-module JOIN) into `auth_users`, like
 * `IntegrationCredentialLockout`. Only the SHA-256 of the `state` secret is
 * stored; the PKCE `code_verifier` is stored as-is (useless without a
 * matching code and the client secret) and deleted with the row.
 */
@Entity('integrations_oauth_states')
export class IntegrationOauthState {
  @PrimaryGeneratedColumn()
    id!: number;

  @Index('idx_integrations_oauth_states_uuid', { unique: true })
  @Column({ type: 'char', length: 36 })
    uuid!: string;

  @Index('idx_integrations_oauth_states_user_id')
  @Column({ name: 'user_id', type: 'int' })
    userId!: number;

  @Column({ name: 'secret_hash', type: 'char', length: 64 })
    secretHash!: string;

  @Column({ type: 'varchar', length: 16 })
    purpose!: OauthStatePurpose;

  @Column({ type: 'varchar', length: 100, nullable: true })
    label!: string | null;

  @Column({ name: 'integration_uuid', type: 'char', length: 36, nullable: true })
    integrationUuid!: string | null;

  @Column({ name: 'code_verifier', type: 'varchar', length: 128 })
    codeVerifier!: string;

  @Index('idx_integrations_oauth_states_expires_at')
  @Column({ name: 'expires_at', type: 'datetime' })
    expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;
}
