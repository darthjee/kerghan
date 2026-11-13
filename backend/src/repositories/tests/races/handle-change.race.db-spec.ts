import { githubRepo, listingPage } from '../../../integrations/tests/support/github-builders.js';
import { RepositoriesService } from '../../repositories.service.js';
import { pagesOf, sourcesOf, statusesOf } from '../support/repo-rows.js';
import { buildRepositoriesDbHarness, type RepositoriesDbHarness } from '../support/repositories-db-harness.js';
import { reachCall, reconcile, ref } from '../support/sync-harness.js';
import { seedTwoUserBaseline, setHandle, snapshotUserRows } from '../support/two-user-baseline.js';

describe('Handle changed during a sync (race)', () => {
  let harness: RepositoriesDbHarness;
  let service: RepositoriesService;
  let userId: number;
  let intruderId: number;
  let intruderBefore: Record<string, unknown[]>;

  beforeEach(async () => {
    harness = await buildRepositoriesDbHarness();
    service = harness.get(RepositoriesService);
    ({ userId, intruderId } = await seedTwoUserBaseline(harness.ds, { handle: 'darthjee' }));
    intruderBefore = await snapshotUserRows(harness.ds, intruderId);
    await reconcile(harness, userId);
  });

  afterEach(async () => {
    expect(await snapshotUserRows(harness.ds, intruderId)).toEqual(intruderBefore);
    await harness.close();
  });

  it('the handle source writes no status and no row of the old handle, the new one reads pending, the others finish', async () => {
    harness.github.setUsable(userId, [ref(5)]);
    harness.github.script(5, 'listRepositories', 1, listingPage(1, [githubRepo({ id: 10 })]));
    const held = harness.github.hold(5, 'listHandleRepositories', 1);

    await service.refresh(userId);
    const run = harness.launcher.runAll();

    await reachCall(harness, (call) => call.operation === 'listHandleRepositories');
    // Auth's handle write, then the next request's reconciliation.
    await setHandle(harness.ds, userId, 'newhandle');
    expect(await service.reconcileForRequest(userId)).toEqual({ kind: 'ok', handle: 'newhandle' });
    held.resolve(listingPage(1, [githubRepo({ id: 20, owner: 'darthjee' })]));
    await run;

    expect(await sourcesOf(harness.ds, userId)).toEqual(['10|integration:5|1']);
    expect((await pagesOf(harness.ds, userId)).map((page) => page.split('|')[0])).toEqual(['integration:5']);
    expect(Object.keys(await statusesOf(harness.ds, userId))).toEqual(['integration:5']);
    expect((await service.syncState(userId))).toMatchObject({
      state: 'idle',
      sources: [{ kind: 'integration', status: 'ok' }, { kind: 'handle', handle: 'newhandle', status: 'pending' }],
    });
  });
});
