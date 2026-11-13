import type { MigrationInterface, QueryRunner, TableColumnOptions } from 'typeorm';
import { Table, TableIndex } from 'typeorm';
import { idColumn } from './helpers.js';

const TABLE_NAME = 'repositories_sources';

const COLUMNS: TableColumnOptions[] = [
  idColumn(),
  { name: 'user_id', type: 'int' },
  { name: 'repository_id', type: 'int' },
  { name: 'source_key', type: 'varchar', length: '32' },
  { name: 'page', type: 'smallint' },
];

export const REPOSITORIES_SOURCES_INDEXES: TableIndex[] = [
  new TableIndex({
    name: 'idx_repositories_sources_repository_id_source_key',
    columnNames: ['repository_id', 'source_key'],
    isUnique: true,
  }),
  new TableIndex({
    name: 'idx_repositories_sources_user_id_source_key_page',
    columnNames: ['user_id', 'source_key', 'page'],
  }),
];

/**
 * Creates `repositories_sources`: which source (`integration:<id>` or
 * `handle`) returned each repository, and on which page (see
 * `docs/agents/specs/repos/model.md#repositories_sources`). Logical FKs only.
 * `down` drops the table.
 */
export class RepositoriesCreateRepositoriesSources20261113120023 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({ name: TABLE_NAME, columns: COLUMNS }), true);

    for (const index of REPOSITORIES_SOURCES_INDEXES) {
      await queryRunner.createIndex(TABLE_NAME, index);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(TABLE_NAME);
  }
}
