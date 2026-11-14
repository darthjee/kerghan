import { seedRepo, seedStatus, sourcesOf, statusesOf } from './support/repo-rows.js';
import { buildRepositoriesDbHarness, HARNESS_START, type RepositoriesDbHarness } from './support/repositories-db-harness.js';
import { reconcile, ref, runSync } from './support/sync-harness.js';
import { seedTwoUserBaseline } from './support/two-user-baseline.js';
import { githubRepo, listingPage, rateLimited } from '../../integrations/tests/support/github-builders.js';

describe('Sync rate limits (real MySQL)', () => {
  let harness: RepositoriesDbHarness;
  let userId: number;

  beforeEach(async () => {
    harness = await buildRepositoriesDbHarness();
    ({ userId } = await seedTwoUserBaseline(harness.ds, { handle: 'darthjee' }));
    await reconcile(harness, userId);
  });

  afterEach(() => harness.close());

  it('skips a rate_limited source while its resetAt is ahead (Refresh included), then calls it after', async () => {
    const resetAt = new Date(HARNESS_START.getTime() + 30 * 60_000);

    await seedRepo(harness.ds, userId, { githubId: 1, sources: [['handle', 1]] });
    await seedStatus(harness.ds, userId, 'handle', 'rate_limited', resetAt);
    harness.github.script(null, 'listHandleRepositories', 1, listingPage(1, [githubRepo({ id: 2 })]));

    await runSync(harness, userId);

    expect(harness.github.githubCalls()).toEqual([]);
    expect(await statusesOf(harness.ds, userId)).toEqual({
      handle: { status: 'rate_limited', resetAt, syncedAt: new Date('2026-05-01T00:00:00Z') },
    });
    expect(await sourcesOf(harness.ds, userId)).toEqual(['1|handle|1']);

    harness.clock.set(new Date(resetAt.getTime() + 1000));
    await runSync(harness, userId);
    expect(harness.github.githubCalls()).toHaveLength(1);
    expect((await statusesOf(harness.ds, userId)).handle.status).toBe('ok');
  });

  it('a refused budget acquire marks the unauthenticated source rate_limited with that reset and keeps its rows', async () => {
    const resetAt = new Date('2026-06-01T12:40:00Z');

    await seedRepo(harness.ds, userId, { githubId: 1, sources: [['handle', 1]] });
    harness.github.script(null, 'listHandleRepositories', 1, { kind: 'rate_limited', resetAt });

    await runSync(harness, userId);

    expect((await statusesOf(harness.ds, userId)).handle).toMatchObject({ status: 'rate_limited', resetAt });
    expect(await sourcesOf(harness.ds, userId)).toEqual(['1|handle|1']);
  });

  it('a rate limit mid-source keeps the applied pages and the old rows of the rest', async () => {
    const resetAt = new Date('2026-06-01T12:40:00Z');

    harness.github.setUsable(userId, [ref(5)]);
    harness.github.script(5, 'listHandleRepositories', '*', listingPage(1, []));
    await seedRepo(harness.ds, userId, { githubId: 9, sources: [['integration:5', 2]] });
    harness.github.script(5, 'listRepositories', 1, listingPage(1, [githubRepo({ id: 8 })], { hasNext: true }));
    harness.github.script(5, 'listRepositories', 2, rateLimited(resetAt));

    await runSync(harness, userId);

    expect(await sourcesOf(harness.ds, userId)).toEqual(['8|integration:5|1', '9|integration:5|2']);
    expect((await statusesOf(harness.ds, userId))['integration:5']).toMatchObject({ status: 'rate_limited', resetAt });
  });
});
