import type { DataSource } from 'typeorm';

const SEEDED_AT = new Date('2026-05-01T00:00:00Z');

/** How to seed one `repositories` row and its source rows. */
export interface RepoSeed {
  githubId: number;
  owner?: string;
  name?: string;
  private?: boolean;
  addedAt?: Date | null;
  integrationId?: number | null;
  lastSeenAt?: Date;
  /** Source rows: `[sourceKey, page]`. */
  sources?: Array<[string, number]>;
}

/**
 * Inserts a repository row and its source rows.
 * @param ds - The data source.
 * @param userId - The owner.
 * @param seed - The row.
 * @returns The repository id.
 */
export async function seedRepo(ds: DataSource, userId: number, seed: RepoSeed): Promise<number> {
  const result: { insertId: number } = await ds.query(
    'INSERT INTO repositories (user_id, github_id, owner, name, private, added_at, integration_id, last_seen_at) '
    + 'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      userId, seed.githubId, seed.owner ?? 'octo', seed.name ?? `repo-${seed.githubId}`, seed.private ?? false,
      seed.addedAt ?? null, seed.integrationId ?? null, seed.lastSeenAt ?? SEEDED_AT,
    ],
  );

  for (const [key, page] of seed.sources ?? []) {
    await ds.query('INSERT INTO repositories_sources (user_id, repository_id, source_key, page) VALUES (?, ?, ?, ?)',
      [userId, result.insertId, key, page]);
  }

  return result.insertId;
}

/**
 * Inserts a page row.
 * @param ds - The data source.
 * @param userId - The owner.
 * @param key - The source key.
 * @param page - The page.
 * @param options - ETag and `has_next`.
 * @param options.etag - The stored ETag.
 * @param options.hasNext - Whether a next page existed.
 */
export async function seedPage(
  ds: DataSource,
  userId: number,
  key: string,
  page: number,
  options: { etag?: string | null; hasNext?: boolean } = {},
): Promise<void> {
  await ds.query('INSERT INTO repositories_source_pages (user_id, source_key, page, etag, has_next, fetched_at) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, key, page, options.etag === undefined ? `W/"${key}-${page}"` : options.etag, options.hasNext ?? false, SEEDED_AT]);
}

/**
 * Inserts a status row.
 * @param ds - The data source.
 * @param userId - The owner.
 * @param key - The source key.
 * @param status - The status.
 * @param resetAt - The rate-limit reset.
 */
export async function seedStatus(ds: DataSource, userId: number, key: string, status: string, resetAt: Date | null = null): Promise<void> {
  await ds.query('INSERT INTO repositories_source_statuses (user_id, source_key, status, synced_at, reset_at) VALUES (?, ?, ?, ?, ?)',
    [userId, key, status, SEEDED_AT, resetAt]);
}

/**
 * Inserts (or replaces) a sync-state row.
 * @param ds - The data source.
 * @param userId - The owner.
 * @param values - Column values (snake_case).
 */
export async function seedSyncState(ds: DataSource, userId: number, values: Record<string, unknown> = {}): Promise<void> {
  const columns = { state: 'idle', ...values };
  const names = Object.keys(columns);

  await ds.query(
    `REPLACE INTO repositories_sync_states (user_id, ${names.join(', ')}) VALUES (?, ${names.map(() => '?').join(', ')})`,
    [userId, ...Object.values(columns)],
  );
}

/** One user's `repositories` rows, ordered by `github_id`. */
export async function reposOf(ds: DataSource, userId: number): Promise<Array<Record<string, unknown>>> {
  return ds.query(
    'SELECT id, CAST(github_id AS CHAR) AS github_id, owner, name, private, added_at, integration_id, last_seen_at '
    + 'FROM repositories WHERE user_id = ? ORDER BY github_id',
    [userId],
  );
}

/** One user's source rows as `githubId|sourceKey|page` strings, sorted. */
export async function sourcesOf(ds: DataSource, userId: number): Promise<string[]> {
  const rows: Array<{ github_id: string; source_key: string; page: number }> = await ds.query(
    'SELECT CAST(r.github_id AS CHAR) AS github_id, s.source_key, s.page FROM repositories_sources s '
    + 'JOIN repositories r ON r.id = s.repository_id WHERE s.user_id = ?',
    [userId],
  );

  return rows.map((row) => `${row.github_id}|${row.source_key}|${row.page}`).sort();
}

/** One user's page rows as `sourceKey|page|etag|hasNext` strings, sorted. */
export async function pagesOf(ds: DataSource, userId: number): Promise<string[]> {
  const rows: Array<{ source_key: string; page: number; etag: string | null; has_next: number }> = await ds.query(
    'SELECT source_key, page, etag, has_next FROM repositories_source_pages WHERE user_id = ?',
    [userId],
  );

  return rows.map((row) => `${row.source_key}|${row.page}|${row.etag}|${Number(row.has_next) === 1}`).sort();
}

/** One user's status rows, keyed by source key. */
export async function statusesOf(ds: DataSource, userId: number): Promise<Record<string, { status: string; resetAt: Date | null; syncedAt: Date }>> {
  const rows: Array<{ source_key: string; status: string; reset_at: Date | null; synced_at: Date }> = await ds.query(
    'SELECT source_key, status, reset_at, synced_at FROM repositories_source_statuses WHERE user_id = ?',
    [userId],
  );

  return Object.fromEntries(rows.map((row) => [row.source_key, { status: row.status, resetAt: row.reset_at, syncedAt: row.synced_at }]));
}

/** One user's sync-state row, or `undefined`. */
export async function syncStateOf(ds: DataSource, userId: number): Promise<Record<string, unknown> | undefined> {
  const rows: Array<Record<string, unknown>> = await ds.query('SELECT * FROM repositories_sync_states WHERE user_id = ?', [userId]);

  return rows[0];
}
