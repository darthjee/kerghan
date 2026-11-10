import type { QueryRunner, TableColumn } from 'typeorm';
import { AuthAddUsersGithubHandle20261110120021 } from '../migrations/20261110120021-auth-add-users-github-handle.js';

function fakeQueryRunner(): { addColumn: jest.Mock; dropColumn: jest.Mock; query: jest.Mock } {
  return {
    addColumn: jest.fn().mockResolvedValue(undefined),
    dropColumn: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue(undefined),
  };
}

describe('AuthAddUsersGithubHandle20261110120021', () => {
  const migration = new AuthAddUsersGithubHandle20261110120021();

  it('adds github_handle as a nullable varchar(39) defaulting to null, with no index or uniqueness', async () => {
    const runner = fakeQueryRunner();

    await migration.up(runner as unknown as QueryRunner);

    const [table, column] = runner.addColumn.mock.calls[0] as [string, TableColumn];
    expect(table).toBe('auth_users');
    expect(column).toMatchObject({ name: 'github_handle', type: 'varchar', length: '39', isNullable: true });
    expect(column.default).toBeNull();
    expect(column.isUnique).toBe(false);
  });

  it('runs no backfill', async () => {
    const runner = fakeQueryRunner();

    await migration.up(runner as unknown as QueryRunner);

    expect(runner.query).not.toHaveBeenCalled();
  });

  it('drops the column on down', async () => {
    const runner = fakeQueryRunner();

    await migration.down(runner as unknown as QueryRunner);

    expect(runner.dropColumn).toHaveBeenCalledWith('auth_users', 'github_handle');
  });
});
