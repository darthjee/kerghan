import { RepositoryRecord } from '../entities/repository-record.entity.js';
import { buildRepositoriesDbHarness, type RepositoriesDbHarness } from './support/repositories-db-harness.js';
import { seedUser } from './support/two-user-baseline.js';

const NOW = new Date('2026-06-01T12:00:00Z');

describe('Repositories tables (real MySQL)', () => {
  let harness: RepositoriesDbHarness;

  beforeAll(async () => {
    harness = await buildRepositoriesDbHarness();
  });

  afterAll(() => harness.close());

  async function insertRepo(userId: number, githubId: number): Promise<RepositoryRecord> {
    return harness.ds.getRepository(RepositoryRecord).save({
      userId, githubId, owner: 'octo', name: `r${githubId}`, private: false, addedAt: null, integrationId: null, lastSeenAt: NOW,
    });
  }

  it('rejects a second row for the same (user_id, github_id); two users can each hold one', async () => {
    const a = await seedUser(harness.ds, 'a');
    const b = await seedUser(harness.ds, 'b');

    await insertRepo(a, 5);
    await expect(insertRepo(a, 5)).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
    await expect(insertRepo(b, 5)).resolves.toMatchObject({ userId: b, githubId: 5 });
  });

  it('stores and reads back a github_id above 2^31 exactly', async () => {
    const a = await seedUser(harness.ds, 'a');
    const big = 2 ** 31 + 123_456_789;

    const saved = await insertRepo(a, big);
    const read = await harness.ds.getRepository(RepositoryRecord).findOneByOrFail({ id: saved.id });

    expect(read.githubId).toBe(big);
    expect(typeof read.githubId).toBe('number');
  });

  it('keeps one source row per (repository, source)', async () => {
    const a = await seedUser(harness.ds, 'a');
    const repo = await insertRepo(a, 9);
    const sql = 'INSERT INTO repositories_sources (user_id, repository_id, source_key, page) VALUES (?, ?, ?, ?)';

    await harness.ds.query(sql, [a, repo.id, 'handle', 1]);
    await harness.ds.query(sql, [a, repo.id, 'integration:1', 1]);
    await expect(harness.ds.query(sql, [a, repo.id, 'handle', 2])).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  });

  it('keeps one page row per (user, source, page)', async () => {
    const a = await seedUser(harness.ds, 'a');
    const b = await seedUser(harness.ds, 'b');
    const sql = 'INSERT INTO repositories_source_pages (user_id, source_key, page, etag, has_next, fetched_at) VALUES (?, ?, ?, NULL, false, ?)';

    await harness.ds.query(sql, [a, 'handle', 1, NOW]);
    await harness.ds.query(sql, [a, 'handle', 2, NOW]);
    await harness.ds.query(sql, [b, 'handle', 1, NOW]);
    await expect(harness.ds.query(sql, [a, 'handle', 1, NOW])).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  });

  it('keeps one status row per (user, source)', async () => {
    const a = await seedUser(harness.ds, 'a');
    const b = await seedUser(harness.ds, 'b');
    const sql = 'INSERT INTO repositories_source_statuses (user_id, source_key, status, synced_at) VALUES (?, ?, ?, ?)';

    await harness.ds.query(sql, [a, 'integration:1', 'ok', NOW]);
    await harness.ds.query(sql, [b, 'integration:1', 'ok', NOW]);
    await expect(harness.ds.query(sql, [a, 'integration:1', 'error', NOW])).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  });
});
