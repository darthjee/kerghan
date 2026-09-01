# Token model and event

Add the `PasswordResetToken` entity, its migration, and the `PasswordRecoveryRequestedEvent` —
the foundation the next two steps build on. No routes yet.

`PasswordResetToken` mirrors `RefreshToken` (`backend/src/auth/entities/refresh-token.entity.ts`)
almost exactly, swapping its revocable `revokedAt` for single-use `usedAt`:

```ts
@Entity('auth_password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn()
    id!: number;

  @Index({ unique: true })
  @Column({ name: 'token_hash' })
    tokenHash!: string;

  @Column({ name: 'user_id' })
    userId!: number;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @Column({ name: 'expires_at' })
    expiresAt!: Date;

  @Column({ name: 'used_at', type: 'datetime', nullable: true })
    usedAt!: Date | null;
}
```

The migration follows `20260824120002-auth-create-refresh-tokens.ts`'s exact shape: table
`auth_password_reset_tokens`, columns `id`, `token_hash` (unique), `user_id` (int, logical FK,
no physical FK), `created_at` (datetime, default `CURRENT_TIMESTAMP`), `expires_at` (datetime),
`used_at` (datetime, nullable) — plus an index on `user_id`
(`idx_auth_password_reset_tokens_user_id`). Use the next sequential timestamp prefix after the
existing four migrations in `backend/src/database/migrations/`.

`PasswordRecoveryRequestedEvent` mirrors `UserRegisteredEvent`
(`backend/src/auth/events/user-registered.event.ts`) exactly in shape and doc-comment style
(a plain class, no listener yet, event name e.g. `password-recovery.requested` fired via
`EventEmitter2`), carrying `userId`, `token` (the plaintext, one-time value), and `resetUrl`
(`${FRONTEND_BASE_URL}/#/recover-password?token=<token>` — see `plan.md`'s "Shared contracts").

## Files to Change

- `backend/src/auth/entities/password-reset-token.entity.ts` — new entity, as above.
- `backend/src/database/migrations/<timestamp>-auth-create-password-reset-tokens.ts` — new
  migration, as above.
- `backend/src/auth/events/password-recovery-requested.event.ts` — new event class, as above.
- `backend/src/auth/auth.module.ts` — add `PasswordResetToken` to
  `TypeOrmModule.forFeature([...])` alongside `User`, `RefreshToken`, `Session`.
