import { githubRepo, listingPage, serverError } from '../../integrations/tests/support/github-builders.js';
import { SyncRunner } from '../sync-runner.js';
import { pagesOf, reposOf, seedPage, seedRepo, seedStatus, sourcesOf, statusesOf } from './support/repo-rows.js';
import { buildRepositoriesDbHarness, type RepositoriesDbHarness } from './support/repositories-db-harness.js';
import { claimRun, reachCall, reconcile, ref } from './support/sync-harness.js';
import { seedTwoUserBaseline, snapshotUserRows } from './support/two-user-baseline.js';

describe('Sync end-of-sync safety net (real MySQL) (race)', () => {
  let harness: RepositoriesDbHarness;
  let userId: number;
  let intruderId: number;
  let intruderIntegrationId: number;
  let intruderBefore: Record<string, unknown[]>;

  beforeEach(async () => {
    harness = await buildRepositoriesDbHarness();
    ({ userId, intruderId, intruderIntegrationId } = await seedTwoUserBaseline(harness.ds));
    intruderBefore = await snapshotUserRows(harness.ds, intruderId);
    await reconcile(harness, userId);
  });

  afterEach(async () => {
    expect(await snapshotUserRows(harness.ds, intruderId)).toEqual(intruderBefore);
    await harness.close();
  });

  it('drops a page written after the integration was deleted (released after the hook), before pruning', async () => {
    harness.github.setUsable(userId, [ref(5), ref(6)]);
    harness.github.script(6, 'listRepositories', '*', listingPage(1, []));
    const held = harness.github.hold(5, 'listRepositories', 1);
    const runId = await claimRun(harness, userId);
    const run = harness.get(SyncRunner).task(userId, runId)();

    await reachCall(harness, (call) => call.integrationId === 5);
    harness.github.setUsable(userId, [ref(6)]);
    held.resolve(listingPage(1, [githubRepo({ id: 1 })]));
    await run;

    expect(await sourcesOf(harness.ds, userId)).toEqual([]);
    expect(await pagesOf(harness.ds, userId)).toEqual(['integration:6|1|W/"etag-page-1"|false']);
    expect(Object.keys(await statusesOf(harness.ds, userId))).toEqual(['integration:6']);
    expect(await reposOf(harness.ds, userId)).toEqual([]);
  });

  it('keeps a still-existing non-usable integration\'s rows, and drops only the user\'s own stale keys', async () => {
    const intruderKey = `integration:${intruderIntegrationId}`;

    await seedRepo(harness.ds, userId, { githubId: 1, sources: [['integration:5', 1]] });
    await seedPage(harness.ds, userId, 'integration:5', 1);
    await seedRepo(harness.ds, userId, { githubId: 2, sources: [['integration:77', 1]] });
    await seedStatus(harness.ds, userId, 'integration:77', 'ok');
    await seedRepo(harness.ds, userId, { githubId: 3, sources: [[intruderKey, 1]] });
    harness.github.setUsable(userId, []);
    harness.github.setIntegrations(userId, [ref(5)]);
    harness.github.script(5, 'listRepositories', '*', serverError());

    const runId = await claimRun(harness, userId);
    await harness.get(SyncRunner).task(userId, runId)();

    expect(await sourcesOf(harness.ds, userId)).toEqual(['1|integration:5|1']);
    expect((await reposOf(harness.ds, userId)).map((row) => row.github_id)).toEqual(['1']);
  });
});
