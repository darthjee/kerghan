import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { HashedTokenBase } from './hashed-token.base.js';

/**
 * Why a refresh token was revoked, stored in `auth_refresh_tokens.revoked_reason`.
 * Only `rotated` tokens trigger replay detection when presented again (a
 * rotated token's successor already exists, so its reuse is a theft signal);
 * every other reason is an intentional revocation and a re-presented token
 * just gets a plain `401`.
 */
export const RevokedReason = {
  /** Rotated by `POST /auth/refresh.json` (a successor token was minted). */
  ROTATED: 'rotated',
  /** Ended by `POST /auth/logout.json`. */
  LOGOUT: 'logout',
  /** Revoked by the user through the session list (`revoke` / `revoke-others`). */
  USER_REVOKED: 'user_revoked',
  /** Revoked by a self-service password change (My Account). */
  PASSWORD_CHANGE: 'password_change',
  /** Revoked by a password-recovery reset. */
  PASSWORD_RESET: 'password_reset',
  /** Revoked by an admin editing the user's password. */
  ADMIN_PASSWORD_CHANGE: 'admin_password_change',
  /** Revoked because a rotated token was replayed (compromise response). */
  REPLAY_DETECTED: 'replay_detected',
} as const;

export type RevokedReason = typeof RevokedReason[keyof typeof RevokedReason];

/**
 * A rotating refresh token issued on login/register/refresh. Owns table
 * `auth_refresh_tokens`. `userId` is a logical foreign key (no physical FK,
 * no cross-module JOIN) into `auth_users`, per the module's database
 * strategy.
 *
 * Only the SHA-256 hash of the token is persisted — the plaintext value is
 * returned to the client once, in the response body, and never stored.
 * `revokedAt` is set the moment a token is rotated (used to mint a new one)
 * or otherwise revoked (logout, session revoke, password change, ...), so a
 * stolen/replayed token is rejected instead of silently accepted;
 * `revokedReason` records why (see `RevokedReason`), so only a replayed
 * *rotated* token triggers replay detection.
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

  @Column({ name: 'revoked_reason', type: 'varchar', length: 32, nullable: true })
    revokedReason!: RevokedReason | null;

  @Column({ name: 'keep_signed_in', default: false })
    keepSignedIn!: boolean;

  @Index()
  @Column({ name: 'session_uuid', length: 36 })
    sessionUuid!: string;

  @Column({ name: 'started_at', type: 'datetime' })
    startedAt!: Date;
}
