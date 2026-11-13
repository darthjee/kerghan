import type { MigrationInterface, QueryRunner, TableColumnOptions } from 'typeorm';
import { Table, TableIndex } from 'typeorm';
import { idColumn } from './helpers.js';

const TABLE_NAME = 'repositories_source_statuses';

const COLUMNS: TableColumnOptions[] = [
  idColumn(),
  { name: 'user_id', type: 'int' },
  { name: 'source_key', type: 'varchar', length: '32' },
  { name: 'status', type: 'varchar', length: '32' },
  { name: 'synced_at', type: 'datetime' },
  { name: 'reset_at', type: 'datetime', isNullable: true },
];

export const REPOSITORIES_SOURCE_STATUSES_INDEXES: TableIndex[] = [
  new TableIndex({
    name: 'idx_repositories_source_statuses_user_id_source_key',
    columnNames: ['user_id', 'source_key'],
    isUnique: true,
  }),
];

/**
 * Creates `repositories_source_statuses`: the status of each source's latest
 * run, one row per (user, source) (see
 * `docs/agents/specs/repos/model.md#repositories_source_statuses`). `down`
 * drops the table.
 */
export class RepositoriesCreateRepositoriesSourceStatuses20261113120026 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({ name: TABLE_NAME, columns: COLUMNS }), true);

    for (const index of REPOSITORIES_SOURCE_STATUSES_INDEXES) {
      await queryRunner.createIndex(TABLE_NAME, index);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(TABLE_NAME);
  }
}
