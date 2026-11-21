import type { MigrationInterface, QueryRunner, TableColumnOptions } from 'typeorm';
import { Table, TableIndex } from 'typeorm';
import { idColumn } from './helpers.js';

const TABLE_NAME = 'issues_projects';

const COLUMNS: TableColumnOptions[] = [
  idColumn(),
  { name: 'uuid', type: 'char', length: '36' },
  { name: 'user_id', type: 'int' },
  { name: 'name', type: 'varchar', length: '100' },
  { name: 'description', type: 'varchar', length: '2000', isNullable: true },
  { name: 'repository_id', type: 'int', isNullable: true },
  { name: 'deleted_at', type: 'datetime', isNullable: true },
  { name: 'deleted_token', type: 'int', default: 0 },
  { name: 'created_at', type: 'datetime' },
  { name: 'updated_at', type: 'datetime' },
];

export const ISSUES_PROJECTS_INDEXES: TableIndex[] = [
  new TableIndex({
    name: 'idx_issues_projects_user_id_name_deleted_token',
    columnNames: ['user_id', 'name', 'deleted_token'],
    isUnique: true,
  }),
  new TableIndex({
    name: 'idx_issues_projects_user_id_repository_id_deleted_token',
    columnNames: ['user_id', 'repository_id', 'deleted_token'],
    isUnique: true,
  }),
  new TableIndex({ name: 'idx_issues_projects_uuid', columnNames: ['uuid'], isUnique: true }),
];

/**
 * Creates the Issues module's `issues_projects` table: one row per project, soft-deleted through
 * `deleted_at` + `deleted_token` (see `docs/agents/specs/issues/model.md#issues_projects`).
 * `user_id` and `repository_id` are logical FKs only (no physical constraint), and the
 * timestamps carry no database default: they come from the injected `Clock`. `down` drops
 * the table.
 */
export class IssuesCreateIssuesProjects20261120120027 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({ name: TABLE_NAME, columns: COLUMNS }), true);

    for (const index of ISSUES_PROJECTS_INDEXES) {
      await queryRunner.createIndex(TABLE_NAME, index);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(TABLE_NAME);
  }
}
