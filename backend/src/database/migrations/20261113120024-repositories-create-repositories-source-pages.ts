import type { MigrationInterface, QueryRunner, TableColumnOptions } from 'typeorm';
import { Table, TableIndex } from 'typeorm';
import { idColumn } from './helpers.js';

const TABLE_NAME = 'repositories_source_pages';

const COLUMNS: TableColumnOptions[] = [
  idColumn(),
  { name: 'user_id', type: 'int' },
  { name: 'source_key', type: 'varchar', length: '32' },
  { name: 'page', type: 'smallint' },
  { name: 'etag', type: 'varchar', length: '255', isNullable: true },
  { name: 'has_next', type: 'boolean' },
  { name: 'fetched_at', type: 'datetime' },
];

export const REPOSITORIES_SOURCE_PAGES_INDEXES: TableIndex[] = [
  new TableIndex({
    name: 'idx_repositories_source_pages_user_id_source_key_page',
    columnNames: ['user_id', 'source_key', 'page'],
    isUnique: true,
  }),
];

/**
 * Creates `repositories_source_pages`: one row per (user, source, page) with
 * the page's `etag`, `has_next` and `fetched_at`, for conditional requests
 * (see `docs/agents/specs/repos/model.md#repositories_source_pages`). `down`
 * drops the table.
 */
export class RepositoriesCreateRepositoriesSourcePages20261113120024 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({ name: TABLE_NAME, columns: COLUMNS }), true);

    for (const index of REPOSITORIES_SOURCE_PAGES_INDEXES) {
      await queryRunner.createIndex(TABLE_NAME, index);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(TABLE_NAME);
  }
}
