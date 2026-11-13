import { githubRepo, integrationUnusable, listingPage } from '../../../integrations/tests/support/github-builders.js';
import { RepositoriesService } from '../../repositories.service.js';
import { deleteIntegrationNow } from '../support/race-actions.js';
import { pagesOf, reposOf, seedRepo, seedStatus, sourcesOf, statusesOf } from '../support/repo-rows.js';
import { buildRepositoriesDbHarness, type RepositoriesDbHarness } from '../support/repositories-db-harness.js';
import { pastCooldown, reachCall, reconcile, ref } from '../support/sync-harness.js';
import { seedTwoUserBaseline, snapshotUserRows } from '../support/two-user-baseline.js';

const ADDED = new Date('2026-05-02T00:00:00Z');
const ALL = { page: 1, perPage: 50, filter: 'all' as const, search: '' };

describe('Integration deletion during a sync (race)', () => {
  let harness: RepositoriesDbHarness;
  let service: RepositoriesService;
  let userId: number;
  let intruderId: number;
  let intruderBefore: Record<string, unknown[]>;

  beforeEach(async () => {
    harness = await buildRepositoriesDbHarness();
    service = harness.get(RepositoriesService);
    ({ userId, intruderId } = await seedTwoUserBaseline(harness.ds));
    intruderBefore = await snapshotUserRows(harness.ds, intruderId);
    await reconcile(harness, userId);
  });

  afterEach(async () => {
    expect(await snapshotUserRows(harness.ds, intruderId)).toEqual(intruderBefore);
    await harness.close();
  });

  it('deleted mid-sync: no status, no row of it remains, links cleared, not-added repos only it held pruned', async () => {
    await seedRepo(harness.ds, userId, { githubId: 1, private: true, addedAt: ADDED, integrationId: 5, sources: [['integration:5', 1]] });
    await seedRepo(harness.ds, userId, { githubId: 2, private: true, sources: [['integration:5', 1]] });
    await seedRepo(harness.ds, userId, { githubId: 3, sources: [['integration:5', 1], ['integration:6', 1]] });
    await seedStatus(harness.ds, userId, 'integration:5', 'ok');
    harness.github.setUsable(userId, [ref(5), ref(6)]);
    harness.github.script(6, 'listRepositories', 1, listingPage(1, [githubRepo({ id: 3 })]));
    harness.github.script(5, 'listRepositories', 2, integrationUnusable('missing'));
    const held = harness.github.hold(5, 'listRepositories', 1);

    expect(await service.refresh(userId)).toEqual({ kind: 'started' });
    const run = harness.launcher.runAll();

    await reachCall(harness, (call) => call.integrationId === 5);
    await deleteIntegrationNow(harness, userId, 5, [ref(6)]);
    // The page answered for the deleted integration is released after the hook's cleanup.
    held.resolve(listingPage(1, [githubRepo({ id: 1, private: true }), githubRepo({ id: 2, private: true })], { hasNext: true }));
    await run;

    expect(harness.logger.error).not.toHaveBeenCalled();
    expect(await sourcesOf(harness.ds, userId)).toEqual(['3|integration:6|1']);
    expect((await pagesOf(harness.ds, userId)).filter((page) => page.startsWith('integration:5'))).toEqual([]);
    expect(Object.keys(await statusesOf(harness.ds, userId))).toEqual(['integration:6']);
    expect((await reposOf(harness.ds, userId)).map((row) => [row.github_id, row.integration_id])).toEqual([['1', null], ['3', null]]);
    expect((await service.list(userId, ALL)).repositories.map((row) => [row.githubId, row.status]).sort())
      .toEqual([[1, 'unavailable'], [3, 'not_added']]);
  });

  it('deleted and re-created with the same credential: Unavailable, then Added after the next sync, linked to the new one', async () => {
    await seedRepo(harness.ds, userId, { githubId: 1, private: true, addedAt: ADDED, integrationId: 5, sources: [['integration:5', 1]] });
    await seedStatus(harness.ds, userId, 'integration:5', 'ok');
    harness.github.setUsable(userId, [ref(5)]);
    harness.github.script(7, 'listRepositories', 1, listingPage(1, [githubRepo({ id: 1, private: true })]));
    harness.github.script(7, 'listHandleRepositories', '*', listingPage(1, []));
    pastCooldown(harness);

    // The run is claimed and kept in the launcher while the integration is deleted and re-created.
    expect(await service.refresh(userId)).toEqual({ kind: 'started' });
    await deleteIntegrationNow(harness, userId, 5, [ref(7)]);

    expect((await service.list(userId, ALL)).repositories).toMatchObject([{ githubId: 1, status: 'unavailable', accessIntegration: null }]);

    await harness.launcher.runAll();

    expect((await service.list(userId, ALL)).repositories).toMatchObject([
      { githubId: 1, status: 'added', accessIntegration: { uuid: 'uuid-7', label: 'label-7' } },
    ]);
  });
});
