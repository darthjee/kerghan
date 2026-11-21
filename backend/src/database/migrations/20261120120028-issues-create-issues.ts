import type { MigrationInterface, QueryRunner, TableColumnOptions } from 'typeorm';
import { Table, TableIndex } from 'typeorm';
import { idColumn } from './helpers.js';

const TABLE_NAME = 'issues';

const COLUMNS: TableColumnOptions[] = [
  idColumn(),
  { name: 'uuid', type: 'char', length: '36' },
  { name: 'project_id', type: 'int' },
  { name: 'title', type: 'varchar', length: '256' },
  { name: 'body', type: 'mediumtext', isNullable: true },
  { name: 'state', type: 'varchar', length: '16', default: "'open'" },
  { name: 'created_at', type: 'datetime' },
  { name: 'updated_at', type: 'datetime', precision: 3 },
];

export const ISSUES_INDEXES: TableIndex[] = [
  new TableIndex({ name: 'idx_issues_uuid', columnNames: ['uuid'], isUnique: true }),
  new TableIndex({ name: 'idx_issues_project_id_state_created_at', columnNames: ['project_id', 'state', 'created_at'] }),
];

/**
 * Creates the Issues module's `issues` table: the Kerghan issues of a project (see
 * `docs/agents/specs/issues/model.md#issues-kerghan-issues`). `project_id` is a logical FK
 * only; `updated_at` is `datetime(3)` so edits within one second still change it. `down`
 * drops the table.
 */
export class IssuesCreateIssues20261120120028 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({ name: TABLE_NAME, columns: COLUMNS }), true);

    for (const index of ISSUES_INDEXES) {
      await queryRunner.createIndex(TABLE_NAME, index);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(TABLE_NAME);
  }
}
