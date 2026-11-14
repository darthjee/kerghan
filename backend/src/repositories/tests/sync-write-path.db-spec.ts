import {
  githubRepo,
  listingPage,
  notModified,
  serverError,
} from '../../integrations/tests/support/github-builders.js';
import { SyncRunner } from '../sync-runner.js';
import { pagesOf, reposOf, seedPage, seedRepo, sourcesOf, statusesOf, syncStateOf } from './support/repo-rows.js';
import { buildRepositoriesDbHarness, HARNESS_START, type RepositoriesDbHarness } from './support/repositories-db-harness.js';
import { claimRun, pastCooldown, reachCall, reconcile, ref, runSync } from './support/sync-harness.js';
import { seedTwoUserBaseline, SHARED_GITHUB_ID, snapshotUserRows } from './support/two-user-baseline.js';

const ADDED = new Date('2026-05-02T00:00:00Z');
const KEY = 'integration:5';

describe('Sync write path (real MySQL)', () => {
  let harness: RepositoriesDbHarness;
  let userId: number;
  let intruderId: number;
  let intruderBefore: Record<string, unknown[]>;

  async function setUp(env: Record<string, string> = {}, handle: string | null = null): Promise<void> {
    harness = await buildRepositoriesDbHarness(env);
    ({ userId, intruderId } = await seedTwoUserBaseline(harness.ds, { handle }));
    intruderBefore = await snapshotUserRows(harness.ds, intruderId);
    await reconcile(harness, userId);
  }

  afterEach(async () => {
    expect(await snapshotUserRows(harness.ds, intruderId)).toEqual(intruderBefore);
    await harness.close();
  });

  it('applies each page in its own transaction; a later failing page keeps the applied pages and the old rows', async () => {
    await setUp();
    await seedRepo(harness.ds, userId, { githubId: 20, sources: [[KEY, 2]] });
    await seedPage(harness.ds, userId, KEY, 1, { hasNext: true });
    await seedPage(harness.ds, userId, KEY, 2);
    harness.github.setUsable(userId, [ref(5)]);
    harness.github.script(5, 'listRepositories', 1, listingPage(1, [githubRepo({ id: 10 })], { hasNext: true, etag: 'W/"new-1"' }));
    harness.github.script(5, 'listRepositories', 2, serverError());

    await runSync(harness, userId);

    expect(await sourcesOf(harness.ds, userId)).toEqual([`10|${KEY}|1`, `20|${KEY}|2`]);
    expect(await pagesOf(harness.ds, userId)).toEqual([`${KEY}|1|W/"new-1"|true`, `${KEY}|2|W/"${KEY}-2"|false`]);
    expect((await statusesOf(harness.ds, userId))[KEY].status).toBe('error');
    expect((await reposOf(harness.ds, userId)).map((row) => row.github_id)).toEqual(['10', '20']);
  });

  it('a failing source does not fail the sync: the other sources are applied', async () => {
    await setUp();
    harness.github.setUsable(userId, [ref(5), ref(6)]);
    harness.github.script(5, 'listRepositories', '*', serverError());
    harness.github.script(6, 'listRepositories', 1, listingPage(1, [githubRepo({ id: 30 })]));

    await runSync(harness, userId);

    expect(await sourcesOf(harness.ds, userId)).toEqual(['30|integration:6|1']);
    expect(await statusesOf(harness.ds, userId)).toMatchObject({ [KEY]: { status: 'error' }, 'integration:6': { status: 'ok' } });
  });

  it('updates a known github_id with its new owner, name and visibility, never touching added_at or integration_id', async () => {
    await setUp();
    await seedRepo(harness.ds, userId, {
      githubId: SHARED_GITHUB_ID, owner: 'old', name: 'old-name', addedAt: ADDED, integrationId: 5, sources: [[KEY, 1]],
    });
    harness.github.setUsable(userId, [ref(5)]);
    harness.github.script(5, 'listRepositories', 1, listingPage(1, [
      githubRepo({ id: SHARED_GITHUB_ID, owner: 'new', name: 'new-name', private: true }),
    ]));

    await runSync(harness, userId);

    expect(await reposOf(harness.ds, userId)).toEqual([expect.objectContaining({
      github_id: String(SHARED_GITHUB_ID), owner: 'new', name: 'new-name', private: 1, added_at: ADDED, integration_id: 5,
      last_seen_at: HARNESS_START,
    })]);
  });

  it('drops the handle row of a repo an integration turns private; deleting the integration then prunes it, the handle failing', async () => {
    await setUp({}, 'darthjee');
    await seedRepo(harness.ds, userId, { githubId: 40, sources: [['handle', 1]] });
    harness.github.setUsable(userId, [ref(5)]);
    harness.github.script(5, 'listRepositories', 1, listingPage(1, [githubRepo({ id: 40, private: true })]));
    harness.github.script(5, 'listHandleRepositories', '*', serverError());

    await runSync(harness, userId);
    expect(await sourcesOf(harness.ds, userId)).toEqual([`40|${KEY}|1`]);

    harness.github.setUsable(userId, []);
    harness.github.script(null, 'listHandleRepositories', '*', serverError());
    pastCooldown(harness);
    await runSync(harness, userId);

    expect(await reposOf(harness.ds, userId)).toEqual([]);
    expect((await statusesOf(harness.ds, userId))[KEY]).toBeUndefined();
  });

  it('deletes the source and page rows past the last page of a successful source', async () => {
    await setUp();
    await seedRepo(harness.ds, userId, { githubId: 50, addedAt: ADDED, sources: [[KEY, 2]] });
    await seedRepo(harness.ds, userId, { githubId: 51, sources: [[KEY, 3]] });
    await seedPage(harness.ds, userId, KEY, 1, { hasNext: true });
    await seedPage(harness.ds, userId, KEY, 2, { hasNext: true });
    await seedPage(harness.ds, userId, KEY, 3);
    harness.github.setUsable(userId, [ref(5)]);
    harness.github.script(5, 'listRepositories', 1, listingPage(1, [githubRepo({ id: 52 })]));

    await runSync(harness, userId);

    expect(await sourcesOf(harness.ds, userId)).toEqual([`52|${KEY}|1`]);
    expect(await pagesOf(harness.ds, userId)).toEqual([`${KEY}|1|W/"etag-page-1"|false`]);
    expect((await reposOf(harness.ds, userId)).map((row) => row.github_id)).toEqual(['50', '52']);
  });

  it('stops at the page cap, stores page_cap_reached, trims rows past the cap, then prunes', async () => {
    await setUp({ KERGHAN_REPOSITORIES_SYNC_PAGE_CAP: '2' });
    await seedRepo(harness.ds, userId, { githubId: 63, sources: [[KEY, 3]] });
    await seedRepo(harness.ds, userId, { githubId: 64, addedAt: ADDED, sources: [[KEY, 3]] });
    await seedPage(harness.ds, userId, KEY, 3);
    harness.github.setUsable(userId, [ref(5)]);
    harness.github.script(5, 'listRepositories', 1, listingPage(1, [githubRepo({ id: 61 })], { hasNext: true }));
    harness.github.script(5, 'listRepositories', 2, listingPage(2, [githubRepo({ id: 62 })], { hasNext: true }));

    await runSync(harness, userId);

    expect(harness.github.githubCalls().map((call) => call.page)).toEqual([1, 2]);
    expect((await statusesOf(harness.ds, userId))[KEY].status).toBe('page_cap_reached');
    expect(await sourcesOf(harness.ds, userId)).toEqual([`61|${KEY}|1`, `62|${KEY}|2`]);
    expect((await pagesOf(harness.ds, userId)).map((row) => row.split('|')[1])).toEqual(['1', '2']);
    expect((await reposOf(harness.ds, userId)).map((row) => row.github_id)).toEqual(['61', '62', '64']);
  });

  it('sets last_synced_at even when every source failed', async () => {
    await setUp();
    harness.github.setUsable(userId, [ref(5)]);
    harness.github.script(5, 'listRepositories', '*', serverError());

    await runSync(harness, userId);

    expect(await syncStateOf(harness.ds, userId)).toMatchObject({ state: 'idle', run_id: null, last_synced_at: HARNESS_START });
  });

  it('a run that lost its lease never sets last_synced_at', async () => {
    await setUp();
    harness.github.setUsable(userId, [ref(5)]);
    const held = harness.github.hold(5, 'listRepositories', 1);
    const runA = await claimRun(harness, userId);
    const finished = harness.get(SyncRunner).task(userId, runA)();

    await reachCall(harness, (call) => call.operation === 'listRepositories');
    pastCooldown(harness);
    const runB = await claimRun(harness, userId);
    held.resolve(listingPage(1, [githubRepo({ id: 70 })]));
    await finished;

    expect(await syncStateOf(harness.ds, userId)).toMatchObject({ state: 'syncing', run_id: runB, last_synced_at: null });
    expect(await reposOf(harness.ds, userId)).toEqual([]);
  });

  it('sets last_seen_at on a 200 and on a 304', async () => {
    await setUp();
    harness.github.setUsable(userId, [ref(5)]);
    harness.github.script(5, 'listRepositories', 1, listingPage(1, [githubRepo({ id: 80, owner: 'first' })], { hasNext: true }));
    harness.github.script(5, 'listRepositories', 2, listingPage(2, [githubRepo({ id: 81 })]));
    await runSync(harness, userId);
    expect((await reposOf(harness.ds, userId))[0]).toMatchObject({ last_seen_at: HARNESS_START });

    pastCooldown(harness);
    harness.github.script(5, 'listRepositories', 1, notModified());
    await runSync(harness, userId);

    expect((await reposOf(harness.ds, userId))[0]).toMatchObject({ owner: 'first', last_seen_at: harness.clock.now() });
  });
});
