import type { MigrationInterface, QueryRunner, TableColumnOptions } from 'typeorm';
import { Table } from 'typeorm';
import { createdAtColumn, updatedAtColumn } from './helpers.js';

const TABLE_NAME = 'repositories_sync_states';

const COLUMNS: TableColumnOptions[] = [
  { name: 'user_id', type: 'int', isPrimary: true },
  { name: 'state', type: 'varchar', length: '16', default: "'idle'" },
  { name: 'run_id', type: 'char', length: '36', isNullable: true },
  { name: 'last_started_at', type: 'datetime', isNullable: true },
  { name: 'heartbeat_at', type: 'datetime', isNullable: true },
  { name: 'last_synced_at', type: 'datetime', isNullable: true },
  { name: 'handle', type: 'varchar', length: '39', isNullable: true },
  createdAtColumn(),
  updatedAtColumn(),
];

/**
 * Creates `repositories_sync_states`: one row per user, keyed by `user_id`
 * (the exception to the auto-increment `id` convention), holding the per-user
 * sync lock, its lease and the reconciled handle (see
 * `docs/agents/modules/repositories.md#repositories_sync_states`). `down` drops
 * the table.
 */
export class RepositoriesCreateRepositoriesSyncStates20261113120025 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({ name: TABLE_NAME, columns: COLUMNS }), true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(TABLE_NAME);
  }
}
