import { readdirSync } from 'fs';
import { DataSource } from 'typeorm';
import {
  assertTestDatabase,
  buildDbTierOptions,
  loadMigrations,
  MIGRATIONS_DIR,
} from './db-tier/db-tier-options.js';
import { getTestDataSource } from './db-tier/db-tier.js';

interface UserRow {
  username: string;
  email: string;
  password_digest: string;
  is_admin: number;
  status: string;
  github_handle: string | null;
}

async function insertUser(ds: DataSource, username: string, email: string): Promise<void> {
  await ds.query(
    'INSERT INTO auth_users (username, email, password_digest, status, github_handle) VALUES (?, ?, ?, ?, ?)',
    [username, email, 'digest', 'approved', 'octocat'],
  );
}

describe('DB test tier (real MySQL)', () => {
  describe('migrations', () => {
    it('records one applied migration per migration source file', async () => {
      const ds = await getTestDataSource();
      const files = readdirSync(MIGRATIONS_DIR).filter((file) => /^[0-9].*\.ts$/.test(file));
      const rows: Array<{ count: number | string }> = await ds.query('SELECT COUNT(*) AS count FROM migrations');

      expect(files.length).toBeGreaterThan(0);
      expect(Number(rows[0].count)).toBe(files.length);
    });

    it('has no pending migrations', async () => {
      const ds = new DataSource(buildDbTierOptions(process.env, await loadMigrations()));

      await ds.initialize();
      try {
        expect(await ds.showMigrations()).toBe(false);
      } finally {
        await ds.destroy();
      }
    });
  });

  describe('round trip', () => {
    it('reads back an inserted auth_users row with the same values, unicode included', async () => {
      const ds = await getTestDataSource();
      const username = 'zoë-🦊-名前';

      await insertUser(ds, username, 'zoe@kerghan.test');
      const rows: UserRow[] = await ds.query(
        'SELECT username, email, password_digest, is_admin, status, github_handle FROM auth_users WHERE email = ?',
        ['zoe@kerghan.test'],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({
        username,
        email: 'zoe@kerghan.test',
        password_digest: 'digest',
        is_admin: 0,
        status: 'approved',
        github_handle: 'octocat',
      });
    });
  });

  // These two rely on Jest's in-file order and on `--runInBand`.
  describe('truncation between tests', () => {
    it('inserts a row (first test)', async () => {
      const ds = await getTestDataSource();

      await insertUser(ds, 'leftover', 'leftover@kerghan.test');
      const rows: Array<{ count: number | string }> = await ds.query('SELECT COUNT(*) AS count FROM auth_users');

      expect(Number(rows[0].count)).toBe(1);
    });

    it('starts the next test with auth_users empty (second test)', async () => {
      const ds = await getTestDataSource();
      const rows: Array<{ count: number | string }> = await ds.query('SELECT COUNT(*) AS count FROM auth_users');

      expect(Number(rows[0].count)).toBe(0);
    });
  });

  describe('guard', () => {
    it('refuses a non-test database name', () => {
      expect(() => assertTestDatabase('kerghan')).toThrow(/must end in "_test"/);
    });

    it('accepts a *_test database name', () => {
      expect(assertTestDatabase('kerghan_test')).toBe('kerghan_test');
    });
  });
});
