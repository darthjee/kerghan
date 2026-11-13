import { randomBytes, randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';

/** A GitHub id above 2³¹ that both baseline users hold a row for. */
export const SHARED_GITHUB_ID = 2 ** 31 + 4242;

/**
 * Inserts an `auth_users` row (test seeding only; Repositories code never
 * touches `auth_users`).
 * @param ds - The data source.
 * @param username - The username.
 * @param handle - The stored, normalised GitHub handle.
 * @returns The user id.
 */
export async function seedUser(ds: DataSource, username: string, handle: string | null = null): Promise<number> {
  const result: { insertId: number } = await ds.query(
    'INSERT INTO auth_users (username, email, password_digest, status, github_handle) VALUES (?, ?, ?, ?, ?)',
    [username, `${username}@kerghan.test`, 'digest', 'approved', handle],
  );

  return result.insertId;
}

/**
 * Sets a user's stored handle (as Auth's `PATCH /auth/account.json` would).
 * @param ds - The data source.
 * @param userId - The user.
 * @param handle - The new handle, or `null`.
 */
export async function setHandle(ds: DataSource, userId: number, handle: string | null): Promise<void> {
  await ds.query('UPDATE auth_users SET github_handle = ? WHERE id = ?', [handle, userId]);
}

/** How to seed one integration row. */
export interface IntegrationSeed {
  type?: 'pat' | 'oauth_app' | 'github_app';
  status?: string;
  createdAt?: Date;
}

/**
 * Inserts an `integrations` row with a dummy (never decrypted) secret.
 * @param ds - The data source.
 * @param userId - The owner.
 * @param seed - Type, status and creation time.
 * @returns The integration id.
 */
export async function seedIntegration(ds: DataSource, userId: number, seed: IntegrationSeed = {}): Promise<number> {
  const label = `int-${randomUUID().slice(0, 8)}`;
  const result: { insertId: number } = await ds.query(
    'INSERT INTO integrations (uuid, user_id, provider, type, label, label_normalized, status, github_login, '
    + 'metadata, secret_key_id, secret_iv, secret_auth_tag, secret_ciphertext, created_at) '
    + 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      randomUUID(), userId, 'github', seed.type ?? 'pat', label, label, seed.status ?? 'active', 'octocat',
      '{}', 'k0000001', randomBytes(12), randomBytes(16), randomBytes(32), seed.createdAt ?? new Date('2026-01-01T00:00:00Z'),
    ],
  );

  return result.insertId;
}

/** Deletes an integration row (as the Integrations module's delete would). */
export async function deleteIntegration(ds: DataSource, integrationId: number): Promise<void> {
  await ds.query('DELETE FROM integrations WHERE id = ?', [integrationId]);
}

/** The two-user baseline (`docs/agents/specs/repos/testing.md#two-user-baseline`). */
export interface TwoUserBaseline {
  userId: number;
  intruderId: number;
  intruderIntegrationId: number;
  intruderRepoId: number;
}

const REPOSITORIES_TABLES = [
  'repositories',
  'repositories_sources',
  'repositories_source_pages',
  'repositories_source_statuses',
  'repositories_sync_states',
];

/**
 * Seeds the user under test and an intruder who holds a repository row with
 * the same `github_id`, its source, page and status rows, a sync-state row
 * and an integration of its own.
 * @param ds - The data source.
 * @param options - Seeding options.
 * @param options.handle - The user's handle.
 * @returns The ids.
 */
export async function seedTwoUserBaseline(ds: DataSource, options: { handle?: string | null } = {}): Promise<TwoUserBaseline> {
  const userId = await seedUser(ds, 'owner', options.handle ?? null);
  const intruderId = await seedUser(ds, 'intruder', 'intruder');
  const intruderIntegrationId = await seedIntegration(ds, intruderId);
  const key = `integration:${intruderIntegrationId}`;
  const repo: { insertId: number } = await ds.query(
    'INSERT INTO repositories (user_id, github_id, owner, name, private, added_at, integration_id, last_seen_at) '
    + 'VALUES (?, ?, ?, ?, ?, NULL, ?, ?)',
    [intruderId, SHARED_GITHUB_ID, 'octo-org', 'shared', true, intruderIntegrationId, new Date('2025-12-01T00:00:00Z')],
  );

  await ds.query('INSERT INTO repositories_sources (user_id, repository_id, source_key, page) VALUES (?, ?, ?, 1), (?, ?, ?, 1)',
    [intruderId, repo.insertId, key, intruderId, repo.insertId, 'handle']);
  await ds.query('INSERT INTO repositories_source_pages (user_id, source_key, page, etag, has_next, fetched_at) '
    + 'VALUES (?, ?, 1, ?, false, ?), (?, ?, 1, ?, false, ?)',
  [intruderId, key, 'W/"i"', new Date('2025-12-01T00:00:00Z'), intruderId, 'handle', 'W/"h"', new Date('2025-12-01T00:00:00Z')]);
  await ds.query('INSERT INTO repositories_source_statuses (user_id, source_key, status, synced_at) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
    [intruderId, key, 'ok', new Date('2025-12-01T00:00:00Z'), intruderId, 'handle', 'ok', new Date('2025-12-01T00:00:00Z')]);
  await ds.query("INSERT INTO repositories_sync_states (user_id, state, handle) VALUES (?, 'idle', 'intruder')", [intruderId]);

  return { userId, intruderId, intruderIntegrationId, intruderRepoId: repo.insertId };
}

/**
 * Every Repositories row of one user, per table, for "untouched" assertions.
 * @param ds - The data source.
 * @param userId - The user.
 * @returns The rows, keyed by table.
 */
export async function snapshotUserRows(ds: DataSource, userId: number): Promise<Record<string, unknown[]>> {
  const snapshot: Record<string, unknown[]> = {};

  for (const table of REPOSITORIES_TABLES) {
    snapshot[table] = await ds.query(`SELECT * FROM \`${table}\` WHERE user_id = ? ORDER BY 1`, [userId]);
  }

  return snapshot;
}

/**
 * Counts one user's rows in every Repositories table.
 * @param ds - The data source.
 * @param userId - The user.
 * @returns The counts, keyed by table.
 */
export async function countUserRows(ds: DataSource, userId: number): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  for (const table of REPOSITORIES_TABLES) {
    const rows: Array<{ count: string | number }> = await ds.query(
      `SELECT COUNT(*) AS count FROM \`${table}\` WHERE user_id = ?`, [userId],
    );
    counts[table] = Number(rows[0].count);
  }

  return counts;
}
