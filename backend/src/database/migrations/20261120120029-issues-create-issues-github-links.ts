import type { MigrationInterface, QueryRunner, TableColumnOptions } from 'typeorm';
import { Table, TableIndex } from 'typeorm';
import { idColumn } from './helpers.js';

const TABLE_NAME = 'issues_github_links';

const COLUMNS: TableColumnOptions[] = [
  idColumn(),
  { name: 'user_id', type: 'int' },
  { name: 'issue_id', type: 'int' },
  { name: 'github_issue_id', type: 'bigint' },
  { name: 'github_number', type: 'int' },
  { name: 'status', type: 'varchar', length: '32' },
  { name: 'status_reason', type: 'varchar', length: '32', isNullable: true },
  { name: 'base_title', type: 'varchar', length: '256' },
  { name: 'base_body', type: 'mediumtext', isNullable: true },
  { name: 'base_state', type: 'varchar', length: '16' },
  { name: 'github_updated_at', type: 'datetime', isNullable: true },
  { name: 'last_synced_at', type: 'datetime', isNullable: true },
  { name: 'etag', type: 'varchar', length: '255', isNullable: true },
  { name: 'created_at', type: 'datetime' },
  { name: 'updated_at', type: 'datetime' },
];

export const ISSUES_GITHUB_LINKS_INDEXES: TableIndex[] = [
  new TableIndex({
    name: 'idx_issues_github_links_user_id_github_issue_id',
    columnNames: ['user_id', 'github_issue_id'],
    isUnique: true,
  }),
  new TableIndex({ name: 'idx_issues_github_links_issue_id', columnNames: ['issue_id'], isUnique: true }),
];

/**
 * Creates `issues_github_links`: the optional one to one link of a Kerghan issue to a GitHub
 * issue, with the base snapshot the sync reconciles against (see
 * `docs/agents/modules/issues/data-model.md#issues_github_links`). `user_id` and `issue_id` are logical
 * FKs only; `user_id` serves the uniqueness rule, never authorization. `down` drops the table.
 */
export class IssuesCreateIssuesGithubLinks20261120120029 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({ name: TABLE_NAME, columns: COLUMNS }), true);

    for (const index of ISSUES_GITHUB_LINKS_INDEXES) {
      await queryRunner.createIndex(TABLE_NAME, index);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(TABLE_NAME);
  }
}
