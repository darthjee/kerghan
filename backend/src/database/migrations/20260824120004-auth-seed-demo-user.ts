import bcrypt from 'bcryptjs';
import type { MigrationInterface, QueryRunner } from 'typeorm';

// Dev/manual-testing convenience only — ported from the old Sequelize
// seeder (backend/seeders/20260808060903-demo-user.js). This migration
// runs as part of `yarn migration:run` (wired into `make setup`), so the
// demo login stays available out of the box: username "demo" / password
// "kerghan-demo".
const USERNAME = 'demo';
const EMAIL = 'demo@kerghan.test';
const PASSWORD = 'kerghan-demo';

/**
 * Seeds a demo user for local/manual testing. No CI/deploy step runs
 * migrations against production today, but that's an operational
 * assumption, not an enforced guarantee — `up()` is also explicitly gated
 * on `STAGE` (the same env var `docker-compose.yml` sets to `production`
 * for `kerghan_prod_app`) so this hardcoded credential can never be
 * created even if `yarn migration:run` is ever pointed at a production
 * database.
 */
export class AuthSeedDemoUser20260824120004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (process.env.STAGE === 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        `Skipping ${AuthSeedDemoUser20260824120004.name}: STAGE=production, refusing to seed the demo user.`,
      );
      return;
    }

    const passwordDigest = await bcrypt.hash(PASSWORD, 10);

    await queryRunner.query(
      'INSERT INTO auth_users (username, email, password_digest) VALUES (?, ?, ?)',
      [USERNAME, EMAIL, passwordDigest],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM auth_users WHERE username = ?', [USERNAME]);
  }
}
