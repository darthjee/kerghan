import type { MigrationInterface } from 'typeorm';
import { getTestDataSource } from './db-tier/db-tier.js';
import { RepositoriesCreateRepositories20261113120022 } from '../migrations/20261113120022-repositories-create-repositories.js';
import { RepositoriesCreateRepositoriesSources20261113120023 } from '../migrations/20261113120023-repositories-create-repositories-sources.js';
import { RepositoriesCreateRepositoriesSourcePages20261113120024 } from '../migrations/20261113120024-repositories-create-repositories-source-pages.js';
import { RepositoriesCreateRepositoriesSyncStates20261113120025 } from '../migrations/20261113120025-repositories-create-repositories-sync-states.js';
import { RepositoriesCreateRepositoriesSourceStatuses20261113120026 } from '../migrations/20261113120026-repositories-create-repositories-source-statuses.js';

const MIGRATIONS: Array<[string, MigrationInterface]> = [
  ['repositories', new RepositoriesCreateRepositories20261113120022()],
  ['repositories_sources', new RepositoriesCreateRepositoriesSources20261113120023()],
  ['repositories_source_pages', new RepositoriesCreateRepositoriesSourcePages20261113120024()],
  ['repositories_sync_states', new RepositoriesCreateRepositoriesSyncStates20261113120025()],
  ['repositories_source_statuses', new RepositoriesCreateRepositoriesSourceStatuses20261113120026()],
];

async function indexesOf(table: string): Promise<Array<{ name: string; unique: boolean; columns: string }>> {
  const ds = await getTestDataSource();
  const rows: Array<{ name: string; non_unique: number | string; columns: string }> = await ds.query(
    'SELECT index_name AS name, MIN(non_unique) AS non_unique, '
    + 'GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns '
    + 'FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? '
    + 'GROUP BY index_name ORDER BY index_name',
    [table],
  );

  return rows.map((row) => ({ name: row.name, unique: Number(row.non_unique) === 0, columns: row.columns }));
}

async function tableExists(table: string): Promise<boolean> {
  const ds = await getTestDataSource();
  const runner = ds.createQueryRunner();

  try {
    return await runner.hasTable(table);
  } finally {
    await runner.release();
  }
}

describe('Repositories migrations (real MySQL)', () => {
  it('create the five tables with their indexes', async () => {
    expect(await indexesOf('repositories')).toEqual([
      { name: 'idx_repositories_user_id_added_at', unique: false, columns: 'user_id,added_at' },
      { name: 'idx_repositories_user_id_github_id', unique: true, columns: 'user_id,github_id' },
      { name: 'idx_repositories_user_id_integration_id', unique: false, columns: 'user_id,integration_id' },
      { name: 'idx_repositories_user_id_owner_name', unique: false, columns: 'user_id,owner,name' },
      { name: 'PRIMARY', unique: true, columns: 'id' },
    ]);
    expect(await indexesOf('repositories_sources')).toEqual([
      { name: 'idx_repositories_sources_repository_id_source_key', unique: true, columns: 'repository_id,source_key' },
      { name: 'idx_repositories_sources_user_id_source_key_page', unique: false, columns: 'user_id,source_key,page' },
      { name: 'PRIMARY', unique: true, columns: 'id' },
    ]);
    expect(await indexesOf('repositories_source_pages')).toEqual([
      { name: 'idx_repositories_source_pages_user_id_source_key_page', unique: true, columns: 'user_id,source_key,page' },
      { name: 'PRIMARY', unique: true, columns: 'id' },
    ]);
    expect(await indexesOf('repositories_sync_states')).toEqual([
      { name: 'PRIMARY', unique: true, columns: 'user_id' },
    ]);
    expect(await indexesOf('repositories_source_statuses')).toEqual([
      { name: 'idx_repositories_source_statuses_user_id_source_key', unique: true, columns: 'user_id,source_key' },
      { name: 'PRIMARY', unique: true, columns: 'id' },
    ]);
  });

  it('have no physical foreign key', async () => {
    const ds = await getTestDataSource();
    const rows: unknown[] = await ds.query(
      'SELECT constraint_name FROM information_schema.referential_constraints '
      + "WHERE constraint_schema = DATABASE() AND table_name LIKE 'repositories%'",
    );

    expect(rows).toEqual([]);
  });

  it('run down and up again', async () => {
    const ds = await getTestDataSource();
    const runner = ds.createQueryRunner();

    try {
      for (const [table, migration] of [...MIGRATIONS].reverse()) {
        await migration.down(runner);
        expect(await tableExists(table)).toBe(false);
      }
      for (const [table, migration] of MIGRATIONS) {
        await migration.up(runner);
        expect(await tableExists(table)).toBe(true);
      }
    } finally {
      await runner.release();
    }

    expect((await indexesOf('repositories')).map((index) => index.name)).toContain('idx_repositories_user_id_github_id');
  });
});
