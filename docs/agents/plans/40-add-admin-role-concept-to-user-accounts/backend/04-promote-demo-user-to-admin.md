# Promote the seeded `demo` user to admin (dev only)

Keep admin tooling exercisable out of the box locally, without a general provisioning code path.

- New migration
  `backend/src/database/migrations/20260903120007-auth-promote-demo-user-admin.ts`, class
  `AuthPromoteDemoUserAdmin20260903120007 implements MigrationInterface`.
  - Model it on `20260824120004-auth-seed-demo-user.ts`: `const USERNAME = 'demo';`, and gate
    `up()` on `process.env.STAGE === 'production'` — log the same style of warning and return
    early so the promotion can never run against a production database.
  - `up()` (non-production): `await queryRunner.query('UPDATE auth_users SET is_admin = ? WHERE
    username = ?', [true, USERNAME]);`
  - `down()`: `await queryRunner.query('UPDATE auth_users SET is_admin = ? WHERE username = ?',
    [false, USERNAME]);`
  - Doc-comment: explains why this is a separate later migration rather than an edit to the
    seed-demo-user migration (that migration runs before `is_admin` exists on a fresh DB).
- The manual production path is documentation only — see step 05.

## Files to Change

- `backend/src/database/migrations/20260903120007-auth-promote-demo-user-admin.ts` — new
  dev-only, `STAGE=production`-gated migration promoting `demo` to admin.
