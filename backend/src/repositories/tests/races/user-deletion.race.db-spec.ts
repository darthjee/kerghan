import { githubRepo, listingPage } from '../../../integrations/tests/support/github-builders.js';
import { RepositoriesService } from '../../repositories.service.js';
import { deleteUserNow } from '../support/race-actions.js';
import { seedRepo, syncStateOf } from '../support/repo-rows.js';
import { buildRepositoriesDbHarness, type RepositoriesDbHarness } from '../support/repositories-db-harness.js';
import { reachCall, reconcile, ref } from '../support/sync-harness.js';
import { countUserRows, seedTwoUserBaseline, snapshotUserRows } from '../support/two-user-baseline.js';

const EMPTY = {
  repositories: 0, repositories_sources: 0, repositories_source_pages: 0, repositories_source_statuses: 0, repositories_sync_states: 0,
};

describe('User deletion during a sync (race)', () => {
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
    await seedRepo(harness.ds, userId, { githubId: 1, addedAt: new Date('2026-05-02T00:00:00Z'), sources: [['integration:5', 1]] });
    harness.github.setUsable(userId, [ref(5)]);
  });

  afterEach(async () => {
    expect(await snapshotUserRows(harness.ds, intruderId)).toEqual(intruderBefore);
    await harness.close();
  });

  it('paused at a GitHub call: no row of the user remains after the run, and the sync-state row is not recreated', async () => {
    const held = harness.github.hold(5, 'listRepositories', 1);

    await service.refresh(userId);
    const run = harness.launcher.runAll();

    await reachCall(harness, (call) => call.integrationId === 5);
    await deleteUserNow(harness, userId);
    held.resolve(listingPage(1, [githubRepo({ id: 1 }), githubRepo({ id: 2 })]));
    await run;

    expect(await countUserRows(harness.ds, userId)).toEqual(EMPTY);
    expect(await syncStateOf(harness.ds, userId)).toBeUndefined();
    expect(harness.launcher.errors).toEqual([]);
  });

  it('kept in the launcher: the run\'s start-of-run reconciliation finds no row, stops, and never recreates it', async () => {
    await service.refresh(userId);
    await deleteUserNow(harness, userId);
    await harness.launcher.runAll();

    expect(await countUserRows(harness.ds, userId)).toEqual(EMPTY);
    expect(harness.github.githubCalls()).toEqual([]);
  });
});
