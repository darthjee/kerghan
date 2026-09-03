# Add `is_admin` column and entity field

Add the persisted admin flag to `auth_users` and expose it on the `User` entity.

- New migration `backend/src/database/migrations/20260903120006-auth-add-users-is-admin.ts`,
  class `AuthAddUsersIsAdmin20260903120006 implements MigrationInterface`, following the
  conventions of the neighbouring migrations (`const TABLE_NAME = 'auth_users';`, doc-comment
  explaining the change).
  - `up()`: `await queryRunner.addColumn(TABLE_NAME, new TableColumn({ name: 'is_admin',
    type: 'boolean', default: false, isNullable: false }));` (import `TableColumn` from
    `typeorm`, matching the `Table`/`TableIndex` import style already used).
  - `down()`: `await queryRunner.dropColumn(TABLE_NAME, 'is_admin');`
- `User` entity: add
  `@Column({ name: 'is_admin', default: false }) isAdmin!: boolean;` after `passwordDigest`
  (before the `@CreateDateColumn` timestamps), keeping the existing 4-space property indentation.
- No migration spec — consistent with the rest of `backend/src/database/migrations/` (none
  have specs; CI has no DB service container). The entity field is covered transitively by the
  auth service/e2e specs updated in later steps.

## Files to Change

- `backend/src/database/migrations/20260903120006-auth-add-users-is-admin.ts` — new migration
  adding the `is_admin` column to `auth_users`.
- `backend/src/auth/entities/user.entity.ts` — add the `isAdmin` column property.
