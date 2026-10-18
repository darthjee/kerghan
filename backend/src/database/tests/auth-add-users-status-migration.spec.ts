import type { QueryRunner, TableColumn } from 'typeorm';
import { AuthAddUsersStatus20261017120020 } from '../migrations/20261017120020-auth-add-users-status.js';

interface FakeQueryRunner {
  addColumn: jest.Mock;
  changeColumn: jest.Mock;
  dropColumn: jest.Mock;
  query: jest.Mock;
}

function fakeQueryRunner(): FakeQueryRunner {
  return {
    addColumn: jest.fn().mockResolvedValue(undefined),
    changeColumn: jest.fn().mockResolvedValue(undefined),
    dropColumn: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue(undefined),
  };
}

describe('AuthAddUsersStatus20261017120020', () => {
  const migration = new AuthAddUsersStatus20261017120020();

  describe('up', () => {
    let runner: FakeQueryRunner;

    beforeEach(async () => {
      runner = fakeQueryRunner();
      await migration.up(runner as unknown as QueryRunner);
    });

    it('adds the status column as a nullable varchar(16) first', () => {
      const [table, column] = runner.addColumn.mock.calls[0] as [string, TableColumn];

      expect(table).toBe('auth_users');
      expect(column).toMatchObject({ name: 'status', type: 'varchar', length: '16', isNullable: true });
    });

    it('backfills every existing user (demo seeds included) as approved', () => {
      expect(runner.query).toHaveBeenCalledWith('UPDATE auth_users SET status = \'approved\'');
    });

    it('makes the column NOT NULL, without a default, after the backfill', () => {
      const [table, name, column] = runner.changeColumn.mock.calls[0] as [string, string, TableColumn];

      expect(table).toBe('auth_users');
      expect(name).toBe('status');
      expect(column).toMatchObject({ name: 'status', type: 'varchar', length: '16', isNullable: false });
      expect(column.default).toBeUndefined();
      expect(runner.query.mock.invocationCallOrder[0])
        .toBeLessThan(runner.changeColumn.mock.invocationCallOrder[0]);
      expect(runner.addColumn.mock.invocationCallOrder[0])
        .toBeLessThan(runner.query.mock.invocationCallOrder[0]);
    });
  });

  describe('down', () => {
    it('drops the status column', async () => {
      const runner = fakeQueryRunner();

      await migration.down(runner as unknown as QueryRunner);

      expect(runner.dropColumn).toHaveBeenCalledWith('auth_users', 'status');
    });
  });
});
