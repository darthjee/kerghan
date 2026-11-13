import { githubRepo, listingPage, unauthorized } from '../../../integrations/tests/support/github-builders.js';
import { RepositoriesService } from '../../repositories.service.js';
import { reposOf, seedRepo } from '../support/repo-rows.js';
import { buildRepositoriesDbHarness, type RepositoriesDbHarness } from '../support/repositories-db-harness.js';
import { pastCooldown, reachCall, reconcile, ref } from '../support/sync-harness.js';
import { seedTwoUserBaseline, snapshotUserRows } from '../support/two-user-baseline.js';

// The Integrations half (the `401` for the old credential never marks the
// replaced one `invalid`, by the `secret_iv` compare-and-set) is
// `integrations/tests/integration-store.compare-and-set.db-spec.ts`; here the
// integration is still usable after the Replace, as Integrations reports it.
describe('Credential replaced during a sync (race)', () => {
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

  it('the integration stays usable and reads pending, then ok after the next sync; its rows are kept meanwhile', async () => {
    await seedRepo(harness.ds, userId, { githubId: 1, sources: [['integration:5', 1]] });
    harness.github.setUsable(userId, [ref(5)]);
    const held = harness.github.hold(5, 'listRepositories', 1);

    await service.refresh(userId);
    const run = harness.launcher.runAll();

    await reachCall(harness, (call) => call.integrationId === 5);
    // Replace: the in-flight call still used the old credential and answers 401.
    held.resolve(unauthorized());
    await run;

    expect((await service.syncState(userId)).sources).toEqual([
      { kind: 'integration', integration: { uuid: 'uuid-5', label: 'label-5' }, status: 'pending', syncedAt: null, resetAt: null },
    ]);
    expect((await reposOf(harness.ds, userId)).map((row) => row.github_id)).toEqual(['1']);

    harness.github.script(5, 'listRepositories', 1, listingPage(1, [githubRepo({ id: 1 })]));
    pastCooldown(harness);
    await service.refresh(userId);
    await harness.launcher.runAll();

    expect((await service.syncState(userId)).sources).toMatchObject([{ status: 'ok' }]);
  });
});
