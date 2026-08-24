import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
