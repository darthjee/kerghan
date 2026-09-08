# Entity and migration

Create the `AuthorizationRequest` TypeORM entity and the migration that creates its table,
modeled directly on `password-reset-token.entity.ts` and migration
`20260901120005-auth-create-password-reset-tokens.ts` (logical FK, hash-only token, `snake_case`
column names via `@Column({ name: '...' })`).

`user_id` stores a logical FK (no physical FK constraint, no cross-module JOIN) — a `NULL` value
means the request was created for a username that didn't resolve to a real user, and such a row
can never be approved.

The `status` column is this backend's first native `type: 'enum'` TypeORM column — there is no
existing precedent to follow beyond the shape given below.

## Files to Change

- `backend/src/auth/entities/authorization-request.entity.ts` — new. `@Entity('auth_authorization_requests')`.
  Columns:
  - `id` — `@PrimaryGeneratedColumn()`.
  - `uuid` — `varchar(36)`, unique, generated via `crypto.randomUUID()` when the row is created
    (set in the service, not a DB default).
  - `username` — `varchar`, the username originally submitted (kept even when it doesn't resolve
    to a real user, for audit/debugging — never returned to the client).
  - `userId` — `@Column({ name: 'user_id', nullable: true })`, `number | null`.
  - `status` — `@Column({ type: 'enum', enum: ['open', 'approved', 'denied', 'logged', 'expired'], default: 'open' })`.
  - `pollTokenHash` — `@Column({ name: 'poll_token_hash', unique: true })`.
  - `requestIp` — `@Column({ name: 'request_ip', type: 'varchar', length: 45 })`.
  - `requestUserAgent` — `@Column({ name: 'request_user_agent', type: 'varchar', length: 512 })`.
  - `approvedByUserId` — `@Column({ name: 'approved_by_user_id', nullable: true })`, `number | null`.
  - `createdAt` — `@CreateDateColumn({ name: 'created_at' })`.
  - `expiresAt` — `@Column({ name: 'expires_at', type: 'datetime' })`.
  - `resolvedAt` — `@Column({ name: 'resolved_at', type: 'datetime', nullable: true })`.
  - `loggedAt` — `@Column({ name: 'logged_at', type: 'datetime', nullable: true })`.
- `backend/src/database/migrations/20260903120008-auth-create-authorization-requests.ts` — new.
  Follows the `queryRunner.createTable(...)` + separate `queryRunner.createIndex(...)` calls shape
  of `20260901120005-auth-create-password-reset-tokens.ts` (current migration tail is
  `20260903120007-auth-promote-demo-user-admin.ts`, so this is the next timestamp in sequence).
  - `status` column: `new TableColumn({ name: 'status', type: 'enum', enum: ['open', 'approved', 'denied', 'logged', 'expired'], default: "'open'" })` —
    the string literal must be quoted for `default` (unlike `default: 'CURRENT_TIMESTAMP'`, which
    is an unquoted SQL function).
  - Indexes, named `idx_auth_authorization_requests_<cols>`:
    - unique on `uuid`
    - unique on `poll_token_hash`
    - composite on `(user_id, status)`
    - single on `expires_at`
  - `down()` drops the table (which drops its indexes with it).
