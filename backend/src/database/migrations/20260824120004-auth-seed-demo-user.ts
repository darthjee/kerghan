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
 * Seeds a demo user for local/manual testing. Never runs against
 * production deploys (production migrations are run against a database
 * that never includes this file in its migration path in practice, same
 * caveat the old seeder carried).
 */
export class AuthSeedDemoUser20260824120004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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
