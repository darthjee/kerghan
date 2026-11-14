import { githubRepo, listingPage } from '../../../integrations/tests/support/github-builders.js';
import { RepositoriesService } from '../../repositories.service.js';
import { reposOf, seedRepo, seedStatus } from '../support/repo-rows.js';
import { buildRepositoriesDbHarness, HARNESS_START, type RepositoriesDbHarness } from '../support/repositories-db-harness.js';
import { reachCall, reconcile, ref } from '../support/sync-harness.js';
import { seedTwoUserBaseline, snapshotUserRows } from '../support/two-user-baseline.js';

describe('Add during a sync (race)', () => {
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

  it('the upsert keeps Add\'s added_at and link, and the end-of-sync link fill never overwrites it', async () => {
    await seedRepo(harness.ds, userId, { githubId: 1, private: true, sources: [['integration:5', 1], ['integration:6', 1]] });
    await seedStatus(harness.ds, userId, 'integration:5', 'ok');
    await seedStatus(harness.ds, userId, 'integration:6', 'ok');
    harness.github.setUsable(userId, [ref(5), ref(6)]);
    harness.github.script(6, 'listRepositories', 1, listingPage(1, [githubRepo({ id: 1, private: true })]));
    const held = harness.github.hold(5, 'listRepositories', 1);

    await service.refresh(userId);
    const run = harness.launcher.runAll();

    await reachCall(harness, (call) => call.integrationId === 5);
    // Add links the newer integration 6 (the link fill would have picked the oldest, 5).
    expect((await service.markAdded(userId, { githubId: 1 }, 6)).kind).toBe('added');
    held.resolve(listingPage(1, [githubRepo({ id: 1, private: true })]));
    await run;

    expect(await reposOf(harness.ds, userId)).toMatchObject([{ github_id: '1', added_at: HARNESS_START, integration_id: 6 }]);
  });
});
