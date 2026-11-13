import { pagesOf, reposOf, seedPage, seedRepo, seedStatus, sourcesOf, statusesOf, syncStateOf } from './support/repo-rows.js';
import { buildRepositoriesDbHarness, HARNESS_START, type RepositoriesDbHarness } from './support/repositories-db-harness.js';
import { pastCooldown, reconcile, ref, runSync } from './support/sync-harness.js';
import { seedTwoUserBaseline, setHandle, snapshotUserRows } from './support/two-user-baseline.js';
import {
  githubRepo,
  integrationUnusable,
  listingPage,
  notFound,
  rateLimited,
  redirect,
  serverError,
  timeout,
  unauthorized,
} from '../../integrations/tests/support/github-builders.js';

describe('Sync sources (real MySQL)', () => {
  let harness: RepositoriesDbHarness;
  let userId: number;
  let intruderId: number;
  let intruderBefore: Record<string, unknown[]>;

  beforeEach(async () => {
    harness = await buildRepositoriesDbHarness();
    ({ userId, intruderId } = await seedTwoUserBaseline(harness.ds, { handle: 'darthjee' }));
    intruderBefore = await snapshotUserRows(harness.ds, intruderId);
  });

  afterEach(async () => {
    expect(await snapshotUserRows(harness.ds, intruderId)).toEqual(intruderBefore);
    await harness.close();
  });

  describe('the handle credential', () => {
    it('goes through the oldest usable integration, never storing a private repo', async () => {
      const pub = githubRepo({ id: 101 });
      const priv = githubRepo({ id: 102, private: true });

      harness.github.setUsable(userId, [ref(7), ref(8)]);
      harness.github.script(7, 'listRepositories', '*', listingPage(1, []));
      harness.github.script(8, 'listRepositories', '*', listingPage(1, []));
      harness.github.script(7, 'listHandleRepositories', 1, listingPage(1, [pub, priv]));

      await runSync(harness, userId);

      const handleCalls = harness.github.githubCalls().filter((call) => call.operation === 'listHandleRepositories');
      expect(handleCalls).toEqual([expect.objectContaining({ integrationId: 7, handle: 'darthjee', page: 1 })]);
      expect(await sourcesOf(harness.ds, userId)).toEqual(['101|handle|1']);
      expect((await reposOf(harness.ds, userId)).map((row) => row.github_id)).toEqual(['101']);
      expect((await statusesOf(harness.ds, userId)).handle.status).toBe('ok');
    });

    it('goes unauthenticated only when no integration is usable', async () => {
      harness.github.script(null, 'listHandleRepositories', 1, listingPage(1, [githubRepo({ id: 103 })]));

      await runSync(harness, userId);

      expect(harness.github.githubCalls()).toEqual([expect.objectContaining({ integrationId: null, operation: 'listHandleRepositories' })]);
      expect(await sourcesOf(harness.ds, userId)).toEqual(['103|handle|1']);
    });

    it('restarts from page 1 with the next usable integration after invalid_credentials, then unauthenticated', async () => {
      harness.github.setUsable(userId, [ref(7), ref(8)]);
      harness.github.script(7, 'listRepositories', '*', listingPage(1, []));
      harness.github.script(8, 'listRepositories', '*', listingPage(1, []));
      harness.github.script(7, 'listHandleRepositories', 1, listingPage(1, [githubRepo({ id: 1 })], { hasNext: true }));
      harness.github.script(7, 'listHandleRepositories', 2, unauthorized());
      harness.github.script(8, 'listHandleRepositories', 1, unauthorized());
      harness.github.script(null, 'listHandleRepositories', 1, listingPage(1, [githubRepo({ id: 2 })]));

      await runSync(harness, userId);

      const pages = harness.github.githubCalls()
        .filter((call) => call.operation === 'listHandleRepositories')
        .map((call) => `${call.integrationId}:${call.page}`);
      expect(pages).toEqual(['7:1', '7:2', '8:1', 'null:1']);
      expect(await sourcesOf(harness.ds, userId)).toEqual(['2|handle|1']);
      expect((await statusesOf(harness.ds, userId)).handle.status).toBe('ok');
    });

    it.each([
      ['a rate limit', rateLimited(new Date('2026-06-01T13:00:00Z')), 'rate_limited'],
      ['a timeout', timeout(), 'error'],
      ['a 5xx', serverError(), 'error'],
      ['a redirect', redirect(), 'error'],
    ])('does not fall back on %s', async (_name, answer, status) => {
      harness.github.setUsable(userId, [ref(7), ref(8)]);
      harness.github.script(7, 'listRepositories', '*', listingPage(1, []));
      harness.github.script(8, 'listRepositories', '*', listingPage(1, []));
      harness.github.script(7, 'listHandleRepositories', 1, answer);

      await runSync(harness, userId);

      expect(harness.github.githubCalls().filter((call) => call.operation === 'listHandleRepositories')).toHaveLength(1);
      expect((await statusesOf(harness.ds, userId)).handle.status).toBe(status);
    });

    it('stores not_found on a 404, keeps the rows and pages, prunes nothing, tries no other credential, and retries next sync', async () => {
      await reconcile(harness, userId);
      await seedRepo(harness.ds, userId, { githubId: 1, sources: [['handle', 1]] });
      await seedPage(harness.ds, userId, 'handle', 1);
      harness.github.setUsable(userId, [ref(7), ref(8)]);
      harness.github.script(7, 'listRepositories', '*', listingPage(1, []));
      harness.github.script(8, 'listRepositories', '*', listingPage(1, []));
      harness.github.script(7, 'listHandleRepositories', 1, notFound());

      await runSync(harness, userId);

      expect((await statusesOf(harness.ds, userId)).handle.status).toBe('not_found');
      expect(await sourcesOf(harness.ds, userId)).toEqual(['1|handle|1']);
      expect((await pagesOf(harness.ds, userId)).filter((row) => row.startsWith('handle|'))).toEqual(['handle|1|W/"handle-1"|false']);
      expect(harness.github.githubCalls().filter((call) => call.operation === 'listHandleRepositories')).toHaveLength(1);

      pastCooldown(harness);
      await runSync(harness, userId);
      expect(harness.github.githubCalls().filter((call) => call.operation === 'listHandleRepositories')).toHaveLength(2);
    });

    it('reconciles the handle when the run starts and fetches the current one; no handle, no handle source', async () => {
      await seedRepo(harness.ds, userId, { githubId: 1, sources: [['handle', 1]] });
      harness.github.script(null, 'listHandleRepositories', 1, listingPage(1, []));
      await runSync(harness, userId);
      expect(await syncStateOf(harness.ds, userId)).toMatchObject({ handle: 'darthjee' });

      await setHandle(harness.ds, userId, 'newname');
      pastCooldown(harness);
      await runSync(harness, userId);
      expect(harness.github.githubCalls().at(-1)).toMatchObject({ handle: 'newname' });

      await setHandle(harness.ds, userId, null);
      pastCooldown(harness);
      const before = harness.github.githubCalls().length;
      await runSync(harness, userId);
      expect(harness.github.githubCalls()).toHaveLength(before);
      expect(await syncStateOf(harness.ds, userId)).toMatchObject({ handle: null, state: 'idle' });
      expect((await statusesOf(harness.ds, userId)).handle).toBeUndefined();
    });
  });

  describe('integration sources', () => {
    beforeEach(() => setHandle(harness.ds, userId, null));

    it.each([
      ['status', 'invalid_credentials'],
      ['type_disabled', 'error'],
    ] as const)('a non-usable integration (%s) stores %s and keeps its rows and pages', async (reason, status) => {
      await seedRepo(harness.ds, userId, { githubId: 1, addedAt: HARNESS_START, sources: [['integration:5', 1]] });
      await seedPage(harness.ds, userId, 'integration:5', 1);
      harness.github.setIntegrations(userId, [ref(5)]);
      harness.github.script(5, 'listRepositories', '*', integrationUnusable(reason));

      await runSync(harness, userId);

      expect((await statusesOf(harness.ds, userId))['integration:5'].status).toBe(status);
      expect(await sourcesOf(harness.ds, userId)).toEqual(['1|integration:5|1']);
      expect(await pagesOf(harness.ds, userId)).toEqual(['integration:5|1|W/"integration:5-1"|false']);
    });

    it('a missing integration (deleted since the run listed them) stops its source and writes no status', async () => {
      await seedStatus(harness.ds, userId, 'integration:5', 'ok');
      harness.github.setIntegrations(userId, [ref(5)]);
      harness.github.script(5, 'listRepositories', '*', integrationUnusable('missing'));

      await runSync(harness, userId);

      // The safety net then drops the status row: listIntegrations still lists it here, so it stays.
      expect((await statusesOf(harness.ds, userId))['integration:5'].syncedAt).toEqual(new Date('2026-05-01T00:00:00Z'));
      expect(await syncStateOf(harness.ds, userId)).toMatchObject({ state: 'idle', last_synced_at: HARNESS_START });
    });

    it('a redirect answer makes the source error', async () => {
      harness.github.setUsable(userId, [ref(5)]);
      harness.github.script(5, 'listRepositories', '*', redirect());

      await runSync(harness, userId);

      expect((await statusesOf(harness.ds, userId))['integration:5'].status).toBe('error');
    });
  });
});
