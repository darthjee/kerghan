import type { MigrationInterface, QueryRunner } from 'typeorm';

const USERNAME = 'demo';

/**
 * Promotes the seeded `demo` user (`20260824120004-auth-seed-demo-user.ts`)
 * to admin, for local/manual testing of admin-only tooling. This has to be
 * a separate, later migration rather than an edit to that seed migration's
 * `INSERT`: on a fresh database the `demo` row is inserted before
 * `is_admin` exists (added by `20260903120006-auth-add-users-is-admin.ts`),
 * so setting `is_admin` at insert time would fail migration ordering. Like
 * the seed migration, `up()` is gated on `STAGE` so this promotion can
 * never run against a production database.
 */
export class AuthPromoteDemoUserAdmin20260903120007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (process.env.STAGE === 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        `Skipping ${AuthPromoteDemoUserAdmin20260903120007.name}: STAGE=production, refusing to promote the demo user to admin.`,
      );
      return;
    }

    await queryRunner.query('UPDATE auth_users SET is_admin = ? WHERE username = ?', [true, USERNAME]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('UPDATE auth_users SET is_admin = ? WHERE username = ?', [false, USERNAME]);
  }
}
