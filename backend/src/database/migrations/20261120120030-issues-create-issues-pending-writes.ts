import type { MigrationInterface, QueryRunner, TableColumnOptions } from 'typeorm';
import { Table, TableIndex } from 'typeorm';
import { idColumn } from './helpers.js';

const TABLE_NAME = 'issues_pending_writes';

const COLUMNS: TableColumnOptions[] = [
  idColumn(),
  { name: 'link_id', type: 'int' },
  { name: 'revision', type: 'int' },
  { name: 'marked_at', type: 'datetime' },
  { name: 'updated_at', type: 'datetime' },
];

export const ISSUES_PENDING_WRITES_INDEXES: TableIndex[] = [
  new TableIndex({ name: 'idx_issues_pending_writes_link_id', columnNames: ['link_id'], isUnique: true }),
];

/**
 * Creates `issues_pending_writes`: the pending marker, one row per link with unsent local edits
 * and no payload (see `docs/agents/specs/issues/model.md#issues_pending_writes-the-pending-marker`).
 * `link_id` is a logical FK only. `down` drops the table.
 */
export class IssuesCreateIssuesPendingWrites20261120120030 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({ name: TABLE_NAME, columns: COLUMNS }), true);

    for (const index of ISSUES_PENDING_WRITES_INDEXES) {
      await queryRunner.createIndex(TABLE_NAME, index);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(TABLE_NAME);
  }
}
