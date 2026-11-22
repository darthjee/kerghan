import type { DataSource } from 'typeorm';
import { seedIntruder, type Intruder } from './issues-seeds.js';
import { onTruncated } from '../../../database/tests/db-tier/db-tier.js';

/** What a harness exposes: the intruder of the current test, and the unregistration. */
export interface IntruderBaseline {
  /** The intruder seeded before the current test (throws before the first test's `beforeEach`). */
  readonly intruder: Intruder;
  /** Stops re-seeding the intruder (call when the harness closes). */
  dispose(): void;
}

/**
 * Seeds the intruder of `testing.md#security-verification` (a second approved user with an
 * integration, a project, an issue, a link and a marker of his own) after every per-test
 * truncate, so every DB-backed test starts with two users.
 * @param ds - The harness's data source.
 * @param enabled - `false` for a second harness over rows another harness already seeded.
 * @returns The baseline.
 */
export function seedIntruderEachTest(ds: () => DataSource, enabled = true): IntruderBaseline {
  let current: Intruder | undefined;
  const unregister = enabled ? onTruncated(async () => {
    current = await seedIntruder(ds());
  }) : (): void => undefined;

  return {
    get intruder(): Intruder {
      if (!current) throw new Error('The intruder is seeded before each test: read it from a test or a beforeEach hook');

      return current;
    },
    dispose: unregister,
  };
}

/** The Issues tables the intruder holds rows in, with the column that tells his rows apart. */
const INTRUDER_COLUMNS: Record<string, (intruder: Intruder) => [string, number]> = {
  issues_projects: (intruder) => ['user_id', intruder.userId],
  issues: (intruder) => ['project_id', intruder.projectId],
  issues_github_links: (intruder) => ['user_id', intruder.userId],
  issues_pending_writes: (intruder) => ['link_id', intruder.linkId],
};

/**
 * Counts a table's rows, the intruder's own rows excluded: the count of what the user under test
 * (and the calls under test) wrote.
 * @param ds - The data source.
 * @param intruder - The harness's intruder.
 * @param table - An Issues table.
 * @returns The row count.
 */
export async function countOutsideIntruder(ds: DataSource, intruder: Intruder, table: string): Promise<number> {
  const [column, value] = INTRUDER_COLUMNS[table](intruder);
  const rows: Array<{ total: string }> = await ds.query(`SELECT COUNT(*) AS total FROM ${table} WHERE ${column} <> ?`, [value]);

  return Number(rows[0].total);
}

/**
 * Every row the intruder holds (project, issue, link, marker, integration and the user), for
 * "never touched" assertions: take one before and one after the call under test and compare.
 * @param ds - The data source.
 * @param intruder - The harness's intruder.
 * @returns The rows, keyed by table.
 */
export async function snapshotIntruder(ds: DataSource, intruder: Intruder): Promise<Record<string, unknown[]>> {
  const queries: Record<string, [string, number]> = {
    auth_users: ['SELECT * FROM auth_users WHERE id = ?', intruder.userId],
    integrations: ['SELECT id, user_id, status, label, github_login, updated_at FROM integrations WHERE id = ?', intruder.integrationId],
    issues_projects: ['SELECT * FROM issues_projects WHERE id = ?', intruder.projectId],
    issues: ['SELECT * FROM issues WHERE id = ?', intruder.issueId],
    issues_github_links: ['SELECT * FROM issues_github_links WHERE id = ?', intruder.linkId],
    issues_pending_writes: ['SELECT * FROM issues_pending_writes WHERE id = ?', intruder.markerId],
  };
  const snapshot: Record<string, unknown[]> = {};

  for (const [table, [sql, id]] of Object.entries(queries)) snapshot[table] = await ds.query(sql, [id]);

  return snapshot;
}
