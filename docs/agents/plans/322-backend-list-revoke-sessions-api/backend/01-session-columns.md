# Session columns: migration and entity
Add the session identity to `auth_refresh_tokens`.

- New migration `20261005120017-auth-add-refresh-tokens-session.ts`, following `20261005120015-auth-add-refresh-tokens-keep-signed-in.ts`:
  - add `session_uuid` (`varchar(36)`) and `started_at` (`datetime`), both nullable at first;
  - backfill existing rows: `UPDATE auth_refresh_tokens SET session_uuid = UUID(), started_at = issued_at` (MySQL; every existing row becomes its own session);
  - change both columns to `NOT NULL`;
  - add the non-unique index `idx_auth_refresh_tokens_session_uuid` on `session_uuid` (rotation leaves several rows per session, so it is not unique);
  - `down()` drops the index and both columns.
- `RefreshToken` entity: add `@Index() @Column({ name: 'session_uuid', length: 36 }) sessionUuid!: string` and `@Column({ name: 'started_at', type: 'datetime' }) startedAt!: Date`. Extend the class doc-comment: one session = one chain of rotated tokens sharing `sessionUuid`; at most one row per session is unrevoked.

## Files to Change
- `backend/src/database/migrations/20261005120017-auth-add-refresh-tokens-session.ts`: new migration.
- `backend/src/auth/entities/refresh-token.entity.ts`: the new columns and doc-comment.
