import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Approval status of an account, stored in `auth_users.status`. Only
 * `approved` users pass the session gate (`JwtGuard`); `pending` users wait
 * for an admin, `denied` users are refused for good. Always set explicitly by
 * the service creating the row — there is no column default.
 */
export const UserStatus = {
  /** Registered while approval was required; waiting for an admin. */
  PENDING: 'pending',
  /** Allowed to use the app. */
  APPROVED: 'approved',
  /** Refused (or banned) by an admin; final. */
  DENIED: 'denied',
} as const;

export type UserStatus = typeof UserStatus[keyof typeof UserStatus];

/**
 * A Kerghan account. Login identity is a username/password pair, independent
 * of any GitHub handle (tracked separately, see docs/agents/product.md).
 * Owns table `auth_users` (per the Auth module's table prefix — see
 * docs/agents/architecture/backend.md).
 */
@Entity('auth_users')
export class User {
  @PrimaryGeneratedColumn()
    id!: number;

  @Column({ unique: true })
    username!: string;

  @Column({ unique: true })
    email!: string;

  @Column({ name: 'password_digest' })
    passwordDigest!: string;

  @Column({ name: 'is_admin', default: false })
    isAdmin!: boolean;

  @Column({ type: 'varchar', length: 16 })
    status!: UserStatus;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
