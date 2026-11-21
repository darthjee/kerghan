import type { MigrationInterface } from 'typeorm';
import { getTestDataSource } from './db-tier/db-tier.js';
import { IssuesCreateIssuesProjects20261120120027 } from '../migrations/20261120120027-issues-create-issues-projects.js';
import { IssuesCreateIssues20261120120028 } from '../migrations/20261120120028-issues-create-issues.js';
import { IssuesCreateIssuesGithubLinks20261120120029 } from '../migrations/20261120120029-issues-create-issues-github-links.js';
import { IssuesCreateIssuesPendingWrites20261120120030 } from '../migrations/20261120120030-issues-create-issues-pending-writes.js';

const MIGRATIONS: Array<[string, MigrationInterface]> = [
  ['issues_projects', new IssuesCreateIssuesProjects20261120120027()],
  ['issues', new IssuesCreateIssues20261120120028()],
  ['issues_github_links', new IssuesCreateIssuesGithubLinks20261120120029()],
  ['issues_pending_writes', new IssuesCreateIssuesPendingWrites20261120120030()],
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

describe('Issues migrations (real MySQL)', () => {
  it('create the four tables with their indexes', async () => {
    expect(await indexesOf('issues_projects')).toEqual([
      { name: 'idx_issues_projects_user_id_name_deleted_token', unique: true, columns: 'user_id,name,deleted_token' },
      {
        name: 'idx_issues_projects_user_id_repository_id_deleted_token',
        unique: true,
        columns: 'user_id,repository_id,deleted_token',
      },
      { name: 'idx_issues_projects_uuid', unique: true, columns: 'uuid' },
      { name: 'PRIMARY', unique: true, columns: 'id' },
    ]);
    expect(await indexesOf('issues')).toEqual([
      { name: 'idx_issues_project_id_state_created_at', unique: false, columns: 'project_id,state,created_at' },
      { name: 'idx_issues_uuid', unique: true, columns: 'uuid' },
      { name: 'PRIMARY', unique: true, columns: 'id' },
    ]);
    expect(await indexesOf('issues_github_links')).toEqual([
      { name: 'idx_issues_github_links_issue_id', unique: true, columns: 'issue_id' },
      { name: 'idx_issues_github_links_user_id_github_issue_id', unique: true, columns: 'user_id,github_issue_id' },
      { name: 'PRIMARY', unique: true, columns: 'id' },
    ]);
    expect(await indexesOf('issues_pending_writes')).toEqual([
      { name: 'idx_issues_pending_writes_link_id', unique: true, columns: 'link_id' },
      { name: 'PRIMARY', unique: true, columns: 'id' },
    ]);
  });

  it('keep every index name within MySQL\'s 64 characters', async () => {
    const names = (await Promise.all(MIGRATIONS.map(([table]) => indexesOf(table)))).flat().map((index) => index.name);

    expect(Math.max(...names.map((name) => name.length))).toBeLessThanOrEqual(64);
  });

  it('have no physical foreign key', async () => {
    const ds = await getTestDataSource();
    const rows: unknown[] = await ds.query(
      'SELECT constraint_name FROM information_schema.referential_constraints '
      + "WHERE constraint_schema = DATABASE() AND table_name LIKE 'issues%'",
    );

    expect(rows).toEqual([]);
  });

  it('give no column a database timestamp default and make the marker payload-free', async () => {
    const ds = await getTestDataSource();
    const rows: Array<{ table_name: string; column_name: string }> = await ds.query(
      'SELECT table_name AS table_name, column_name AS column_name FROM information_schema.columns '
      + "WHERE table_schema = DATABASE() AND table_name LIKE 'issues%' AND column_default LIKE 'CURRENT_TIMESTAMP%'",
    );
    const marker: Array<{ column_name: string }> = await ds.query(
      'SELECT column_name AS column_name FROM information_schema.columns '
      + "WHERE table_schema = DATABASE() AND table_name = 'issues_pending_writes' ORDER BY ordinal_position",
    );

    expect(rows).toEqual([]);
    expect(marker.map((row) => row.column_name)).toEqual(['id', 'link_id', 'revision', 'marked_at', 'updated_at']);
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

    expect((await indexesOf('issues_projects')).map((index) => index.name)).toContain('idx_issues_projects_uuid');
  });
});
