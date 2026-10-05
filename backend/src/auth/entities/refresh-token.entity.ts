import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { HashedTokenBase } from './hashed-token.base.js';

/**
 * A rotating refresh token issued on login/register/refresh. Owns table
 * `auth_refresh_tokens`. `userId` is a logical foreign key (no physical FK,
 * no cross-module JOIN) into `auth_users`, per the module's database
 * strategy.
 *
 * Only the SHA-256 hash of the token is persisted — the plaintext value is
 * returned to the client once, in the response body, and never stored.
 * `revokedAt` is set the moment a token is rotated (used to mint a new one)
 * or a user logs out, so a stolen/replayed token is rejected instead of
 * silently accepted.
 *
 * `keepSignedIn` marks a persistent ("keep me signed in") session: the token
 * is minted with the persistent TTL instead of the regular one, and the flag
 * is copied to the replacement token on every rotation.
 *
 * `sessionUuid` identifies a session: one chain of rotated tokens, minted at
 * login and copied (with `startedAt`, the login time) to every replacement
 * token. Since rotation revokes the presented token, at most one row per
 * session is unrevoked at a time.
 */
@Entity('auth_refresh_tokens')
export class RefreshToken extends HashedTokenBase {
  @CreateDateColumn({ name: 'issued_at' })
    issuedAt!: Date;

  @Column({ name: 'revoked_at', type: 'datetime', nullable: true })
    revokedAt!: Date | null;

  @Column({ name: 'keep_signed_in', default: false })
    keepSignedIn!: boolean;

  @Index()
  @Column({ name: 'session_uuid', length: 36 })
    sessionUuid!: string;

  @Column({ name: 'started_at', type: 'datetime' })
    startedAt!: Date;
}
