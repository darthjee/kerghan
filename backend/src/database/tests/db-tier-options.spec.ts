import { assertTestDatabase, buildDbTierOptions, loadMigrations } from './db-tier/db-tier-options.js';

describe('db-tier-options', () => {
  describe('assertTestDatabase', () => {
    it('returns a name ending in _test', () => {
      expect(assertTestDatabase('kerghan_test')).toBe('kerghan_test');
    });

    it.each(['kerghan', 'kerghan_test_backup', 'test', ''])('throws for %p', (name) => {
      expect(() => assertTestDatabase(name)).toThrow(/must end in "_test"/);
    });

    it('throws when the name is missing', () => {
      expect(() => assertTestDatabase(undefined)).toThrow(/got ""/);
    });
  });

  describe('buildDbTierOptions', () => {
    const env = {
      KERGHAN_MYSQL_HOST: 'mysql_test',
      KERGHAN_MYSQL_PORT: '3307',
      KERGHAN_MYSQL_USER: 'kerghan',
      KERGHAN_MYSQL_PASSWORD: 'secret',
      KERGHAN_MYSQL_NAME: 'kerghan_test',
    };

    it('maps the KERGHAN_MYSQL_* env vars onto MySQL options', () => {
      expect(buildDbTierOptions(env)).toEqual({
        type: 'mysql',
        host: 'mysql_test',
        port: 3307,
        username: 'kerghan',
        password: 'secret',
        database: 'kerghan_test',
        poolSize: 5,
        multipleStatements: false,
        entities: [],
        migrations: [],
      });
    });

    it('defaults the port to 3306', () => {
      expect(buildDbTierOptions({ ...env, KERGHAN_MYSQL_PORT: undefined })).toMatchObject({ port: 3306 });
    });

    it('passes the given migrations through', () => {
      class SomeMigration {
        async up(): Promise<void> {}

        async down(): Promise<void> {}
      }

      expect(buildDbTierOptions(env, [SomeMigration]).migrations).toEqual([SomeMigration]);
    });

    it('refuses a non-test database', () => {
      expect(() => buildDbTierOptions({ ...env, KERGHAN_MYSQL_NAME: 'kerghan' })).toThrow(/must end in "_test"/);
    });
  });

  describe('loadMigrations', () => {
    it('loads only the timestamped migration classes, in order', async () => {
      const migrations = await loadMigrations();
      const names = migrations.map((migration) => migration.name);

      expect(names[0]).toBe('AuthCreateUsers20260824120001');
      expect(names).toContain('AuthAddUsersGithubHandle20261110120021');
      expect(names).toEqual([...names].sort((a, b) => a.slice(-14).localeCompare(b.slice(-14))));
      expect(names.some((name) => /helper|skipInProduction/i.test(name))).toBe(false);
    });
  });
});
