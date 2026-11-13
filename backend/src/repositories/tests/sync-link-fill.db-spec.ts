import { reposOf, seedRepo } from './support/repo-rows.js';
import { buildRepositoriesDbHarness, type RepositoriesDbHarness } from './support/repositories-db-harness.js';
import { reconcile, ref, runSync } from './support/sync-harness.js';
import { seedTwoUserBaseline, snapshotUserRows } from './support/two-user-baseline.js';
import { githubRepo, listingPage, serverError } from '../../integrations/tests/support/github-builders.js';

const ADDED = new Date('2026-05-02T00:00:00Z');

describe('Sync link fill (real MySQL)', () => {
  let harness: RepositoriesDbHarness;
  let userId: number;
  let intruderId: number;
  let intruderBefore: Record<string, unknown[]>;

  beforeEach(async () => {
    harness = await buildRepositoriesDbHarness();
    ({ userId, intruderId } = await seedTwoUserBaseline(harness.ds));
    intruderBefore = await snapshotUserRows(harness.ds, intruderId);
    await reconcile(harness, userId);
  });

  afterEach(async () => {
    expect(await snapshotUserRows(harness.ds, intruderId)).toEqual(intruderBefore);
    await harness.close();
  });

  async function linkOf(githubId: number): Promise<unknown> {
    return (await reposOf(harness.ds, userId)).find((row) => row.github_id === String(githubId))?.integration_id;
  }

  it('links the oldest usable integration whose source is ok and holds a row, for an empty or dangling link', async () => {
    const both = githubRepo({ id: 1, private: true });
    const dangling = githubRepo({ id: 2, private: true });

    await seedRepo(harness.ds, userId, { githubId: 1, private: true, addedAt: ADDED });
    await seedRepo(harness.ds, userId, { githubId: 2, private: true, addedAt: ADDED, integrationId: 99 });
    harness.github.setUsable(userId, [ref(5), ref(6), ref(7)]);
    harness.github.script(5, 'listRepositories', '*', serverError());
    harness.github.script(6, 'listRepositories', 1, listingPage(1, [both, dangling]));
    harness.github.script(7, 'listRepositories', 1, listingPage(1, [both]));

    await runSync(harness, userId);

    expect(await linkOf(1)).toBe(6);
    expect(await linkOf(2)).toBe(6);
  });

  it('counts page_cap_reached as ok for the fill', async () => {
    const capped = await buildRepositoriesDbHarness({ KERGHAN_REPOSITORIES_SYNC_PAGE_CAP: '1' });

    try {
      await seedRepo(capped.ds, userId, { githubId: 1, private: true, addedAt: ADDED });
      capped.github.setUsable(userId, [ref(5)]);
      capped.github.script(5, 'listRepositories', '*', listingPage(1, [githubRepo({ id: 1, private: true })], { hasNext: true }));
      await runSync(capped, userId);
    } finally {
      await capped.close();
    }

    expect(await linkOf(1)).toBe(5);
    const rows: Array<{ status: string }> = await harness.ds.query(
      'SELECT status FROM repositories_source_statuses WHERE user_id = ?', [userId],
    );
    expect(rows).toEqual([{ status: 'page_cap_reached' }]);
  });

  it('never touches an existing link, a public repo or a not-added repo', async () => {
    await seedRepo(harness.ds, userId, { githubId: 1, private: true, addedAt: ADDED, integrationId: 6 });
    await seedRepo(harness.ds, userId, { githubId: 2, private: false, addedAt: ADDED });
    await seedRepo(harness.ds, userId, { githubId: 3, private: true });
    harness.github.setUsable(userId, [ref(5)]);
    harness.github.setIntegrations(userId, [ref(5), ref(6)]);
    harness.github.script(5, 'listRepositories', 1, listingPage(1, [
      githubRepo({ id: 1, private: true }), githubRepo({ id: 2 }), githubRepo({ id: 3, private: true }),
    ]));
    harness.github.script(6, 'listRepositories', '*', serverError());

    await runSync(harness, userId);

    expect(await linkOf(1)).toBe(6);
    expect(await linkOf(2)).toBeNull();
    expect(await linkOf(3)).toBeNull();
  });

  it('leaves the link empty with no such integration, and is skipped with no usable integration', async () => {
    await seedRepo(harness.ds, userId, { githubId: 1, private: true, addedAt: ADDED, sources: [['integration:5', 1]] });
    harness.github.setUsable(userId, [ref(5)]);
    harness.github.script(5, 'listRepositories', '*', serverError());

    await runSync(harness, userId);
    expect(await linkOf(1)).toBeNull();

    harness.clock.advance(6 * 60_000);
    harness.github.setUsable(userId, []);
    await runSync(harness, userId);
    expect(await linkOf(1)).toBeNull();
  });
});
