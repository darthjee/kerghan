import { githubRepo, listingPage } from '../../../integrations/tests/support/github-builders.js';
import { RepositoriesService } from '../../repositories.service.js';
import { seedPage, seedRepo, seedStatus } from '../support/repo-rows.js';
import { buildRepositoriesDbHarness, type RepositoriesDbHarness } from '../support/repositories-db-harness.js';
import { reachCall, reconcile, ref } from '../support/sync-harness.js';
import { seedTwoUserBaseline, snapshotUserRows } from '../support/two-user-baseline.js';

const ALL = { page: 1, perPage: 50, filter: 'all' as const, search: '' };
const ADDED = new Date('2026-05-02T00:00:00Z');

describe('An added public repo with no link turns private (race)', () => {
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
    // Added while public, through the handle source only: no access link.
    await seedRepo(harness.ds, userId, { githubId: 1, owner: 'darthjee', name: 'tool', addedAt: ADDED, sources: [['handle', 1]] });
    await seedPage(harness.ds, userId, 'handle', 1);
    await seedStatus(harness.ds, userId, 'handle', 'ok');
  });

  afterEach(async () => {
    expect(await snapshotUserRows(harness.ds, intruderId)).toEqual(intruderBefore);
    await harness.close();
  });

  it('returned by an integration: reads Added, linked to the oldest usable integration that returns it', async () => {
    const turnedPrivate = { id: 1, owner: 'darthjee', name: 'tool', private: true };

    harness.github.setUsable(userId, [ref(4), ref(5), ref(6)]);
    harness.github.script(4, 'listRepositories', 1, listingPage(1, []));
    harness.github.script(5, 'listRepositories', 1, listingPage(1, [githubRepo(turnedPrivate)]));
    harness.github.script(6, 'listRepositories', 1, listingPage(1, [githubRepo(turnedPrivate)]));
    const held = harness.github.hold(4, 'listHandleRepositories', 1);

    await service.refresh(userId);
    const run = harness.launcher.runAll();

    // The repo turns private while the handle listing is in flight; GitHub then lists it as private.
    await reachCall(harness, (call) => call.operation === 'listHandleRepositories');
    held.resolve(listingPage(1, [githubRepo(turnedPrivate)]));
    await run;

    expect((await service.list(userId, ALL)).repositories).toMatchObject([{
      githubId: 1, private: true, status: 'added', accessIntegration: { uuid: 'uuid-5', label: 'label-5' },
      sources: [{ kind: 'integration', integration: { uuid: 'uuid-5' } }, { kind: 'integration', integration: { uuid: 'uuid-6' } }],
    }]);
  });

  it('returned by no integration: reads Unavailable', async () => {
    harness.github.setUsable(userId, [ref(4)]);
    harness.github.script(4, 'listRepositories', 1, listingPage(1, []));
    harness.github.script(4, 'listHandleRepositories', 1, listingPage(1, [githubRepo({ id: 1, owner: 'darthjee', name: 'tool', private: true })]));

    await service.refresh(userId);
    await harness.launcher.runAll();

    expect((await service.list(userId, ALL)).repositories).toMatchObject([{ githubId: 1, status: 'unavailable', sources: [], accessIntegration: null }]);
  });
});
