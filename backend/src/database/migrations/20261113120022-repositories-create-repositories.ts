import type { MigrationInterface, QueryRunner, TableColumnOptions } from 'typeorm';
import { Table, TableIndex } from 'typeorm';
import { createdAtColumn, idColumn, updatedAtColumn } from './helpers.js';

const TABLE_NAME = 'repositories';

const COLUMNS: TableColumnOptions[] = [
  idColumn(),
  { name: 'user_id', type: 'int' },
  { name: 'github_id', type: 'bigint' },
  { name: 'owner', type: 'varchar', length: '39' },
  { name: 'name', type: 'varchar', length: '100' },
  { name: 'private', type: 'boolean' },
  { name: 'added_at', type: 'datetime', isNullable: true },
  { name: 'integration_id', type: 'int', isNullable: true },
  { name: 'last_seen_at', type: 'datetime' },
  createdAtColumn(),
  updatedAtColumn(),
];

export const REPOSITORIES_INDEXES: TableIndex[] = [
  new TableIndex({ name: 'idx_repositories_user_id_github_id', columnNames: ['user_id', 'github_id'], isUnique: true }),
  new TableIndex({ name: 'idx_repositories_user_id_added_at', columnNames: ['user_id', 'added_at'] }),
  new TableIndex({ name: 'idx_repositories_user_id_owner_name', columnNames: ['user_id', 'owner', 'name'] }),
  new TableIndex({ name: 'idx_repositories_user_id_integration_id', columnNames: ['user_id', 'integration_id'] }),
];

/**
 * Creates the Repositories module's `repositories` table: one row per (user,
 * GitHub repository) seen in a sync, with a nullable `added_at` (see
 * `docs/agents/specs/repos/model.md#repositories`). `user_id` and
 * `integration_id` are logical FKs only (no physical constraint). `down`
 * drops the table.
 */
export class RepositoriesCreateRepositories20261113120022 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({ name: TABLE_NAME, columns: COLUMNS }), true);

    for (const index of REPOSITORIES_INDEXES) {
      await queryRunner.createIndex(TABLE_NAME, index);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(TABLE_NAME);
  }
}
