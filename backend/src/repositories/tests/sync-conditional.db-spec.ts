import { pagesOf, reposOf, seedPage, seedRepo, sourcesOf } from './support/repo-rows.js';
import { buildRepositoriesDbHarness, type RepositoriesDbHarness } from './support/repositories-db-harness.js';
import { reconcile, ref, runSync } from './support/sync-harness.js';
import { seedTwoUserBaseline, snapshotUserRows } from './support/two-user-baseline.js';
import { githubRepo, listingPage, notModified } from '../../integrations/tests/support/github-builders.js';

const KEY = 'integration:5';

describe('Sync conditional requests and pagination (real MySQL)', () => {
  let harness: RepositoriesDbHarness;
  let userId: number;
  let intruderId: number;
  let intruderBefore: Record<string, unknown[]>;

  beforeEach(async () => {
    harness = await buildRepositoriesDbHarness({ KERGHAN_REPOSITORIES_SYNC_PAGE_CAP: '3' });
    ({ userId, intruderId } = await seedTwoUserBaseline(harness.ds));
    intruderBefore = await snapshotUserRows(harness.ds, intruderId);
    await reconcile(harness, userId);
    harness.github.setUsable(userId, [ref(5)]);
  });

  afterEach(async () => {
    expect(await snapshotUserRows(harness.ds, intruderId)).toEqual(intruderBefore);
    await harness.close();
  });

  it('sends the stored etag on earlier pages and none on the last stored page', async () => {
    await seedPage(harness.ds, userId, KEY, 1, { etag: 'W/"p1"', hasNext: true });
    await seedPage(harness.ds, userId, KEY, 2, { etag: 'W/"p2"', hasNext: false });
    harness.github.script(5, 'listRepositories', 1, notModified());
    harness.github.script(5, 'listRepositories', 2, listingPage(2, []));

    await runSync(harness, userId);

    expect(harness.github.githubCalls().map((call) => [call.page, call.etag])).toEqual([[1, 'W/"p1"'], [2, null]]);
  });

  it('a 304 reuses the stored page: source rows kept, metadata untouched, the stored has_next continues', async () => {
    await seedRepo(harness.ds, userId, { githubId: 1, owner: 'kept', name: 'kept', sources: [[KEY, 1]] });
    await seedPage(harness.ds, userId, KEY, 1, { etag: 'W/"p1"', hasNext: true });
    await seedPage(harness.ds, userId, KEY, 2, { etag: 'W/"p2"' });
    harness.github.script(5, 'listRepositories', 1, notModified());
    harness.github.script(5, 'listRepositories', 2, listingPage(2, [githubRepo({ id: 2 })], { etag: 'W/"p2b"' }));

    await runSync(harness, userId);

    expect(await sourcesOf(harness.ds, userId)).toEqual([`1|${KEY}|1`, `2|${KEY}|2`]);
    expect((await reposOf(harness.ds, userId))[0]).toMatchObject({ owner: 'kept', name: 'kept' });
    expect(await pagesOf(harness.ds, userId)).toEqual([`${KEY}|1|W/"p1"|true`, `${KEY}|2|W/"p2b"|false`]);
  });

  it('a 304 with a stored has_next = false stops the source', async () => {
    await seedPage(harness.ds, userId, KEY, 1, { etag: 'W/"p1"', hasNext: true });
    await seedPage(harness.ds, userId, KEY, 2, { etag: 'W/"p2"', hasNext: true });
    await seedPage(harness.ds, userId, KEY, 3, { etag: 'W/"p3"', hasNext: false });
    harness.github.script(5, 'listRepositories', 1, notModified());
    harness.github.script(5, 'listRepositories', 2, notModified());
    harness.github.script(5, 'listRepositories', 3, listingPage(3, []));

    await runSync(harness, userId);

    expect(harness.github.githubCalls().map((call) => call.page)).toEqual([1, 2, 3]);
  });

  it('with a full last page and a new repo created since, fetches the new page', async () => {
    const full = Array.from({ length: 100 }, (_, index) => githubRepo({ id: 1000 + index }));

    harness.github.script(5, 'listRepositories', 1, listingPage(1, full, { etag: 'W/"full"' }));
    await runSync(harness, userId);
    expect(await pagesOf(harness.ds, userId)).toEqual([`${KEY}|1|W/"full"|false`]);

    harness.clock.advance(6 * 60_000);
    harness.github.script(5, 'listRepositories', 1, listingPage(1, full, { etag: 'W/"full"', hasNext: true }));
    harness.github.script(5, 'listRepositories', 2, listingPage(2, [githubRepo({ id: 2000 })]));
    await runSync(harness, userId);

    const calls = harness.github.githubCalls().slice(1).map((call) => [call.page, call.etag]);
    expect(calls).toEqual([[1, null], [2, null]]);
    expect(await sourcesOf(harness.ds, userId)).toContain(`2000|${KEY}|2`);
  });

  it('asks for page N + 1 only while hasNext is true, and up to the page cap', async () => {
    harness.github.script(5, 'listRepositories', '*', listingPage(1, [], { hasNext: true }));

    await runSync(harness, userId);

    expect(harness.github.githubCalls().map((call) => call.page)).toEqual([1, 2, 3]);
  });

  it('a 304 for a page with no stored row (never expected) makes the source error', async () => {
    harness.github.script(5, 'listRepositories', 1, notModified());

    await runSync(harness, userId);

    const rows: Array<{ status: string }> = await harness.ds.query(
      'SELECT status FROM repositories_source_statuses WHERE user_id = ?', [userId],
    );
    expect(rows).toEqual([{ status: 'error' }]);
  });
});
