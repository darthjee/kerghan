import { HandleReconciler } from '../handle-reconciler.js';
import { Pruner } from '../pruner.js';
import { SyncStateStore } from '../sync-state.store.js';
import { seedRepo, syncStateOf } from './support/repo-rows.js';
import { buildRepositoriesDbHarness, type RepositoriesDbHarness } from './support/repositories-db-harness.js';
import { seedUser, setHandle } from './support/two-user-baseline.js';

// Type (a) races (`docs/agents/modules/repositories.md#concurrency-and-races`): N operations at once
// on separate pool connections, asserting invariants only. No repeat loops.
const N = 6;

describe('Sync claim concurrency (real MySQL)', () => {
  let harness: RepositoriesDbHarness;
  let store: SyncStateStore;

  beforeAll(async () => {
    harness = await buildRepositoriesDbHarness();
    store = harness.get(SyncStateStore);
  });

  afterAll(() => harness.close());

  it('N concurrent ensureRow create exactly one row', async () => {
    const userId = await seedUser(harness.ds, 'user');

    const results = await Promise.all(Array.from({ length: N }, () => store.ensureRow(userId)));

    expect(results).toEqual(Array(N).fill(true));
    const rows: Array<{ count: string }> = await harness.ds.query(
      'SELECT COUNT(*) AS count FROM repositories_sync_states WHERE user_id = ?', [userId],
    );
    expect(Number(rows[0].count)).toBe(1);
  });

  it('N concurrent claims start exactly one sync', async () => {
    const userId = await seedUser(harness.ds, 'user');

    await store.ensureRow(userId);
    const outcomes = await Promise.all(Array.from({ length: N }, (_, i) => store.claim(userId, i % 2 === 0 ? 'stale' : 'refresh')));
    const started = outcomes.filter((outcome) => outcome.kind === 'started');

    expect(started).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.kind !== 'started').every((outcome) => outcome.kind === 'running')).toBe(true);
    expect(await syncStateOf(harness.ds, userId)).toMatchObject({ state: 'syncing', run_id: (started[0] as { runId: string }).runId });
  });

  it('two concurrent reconciliations reconcile once', async () => {
    const userId = await seedUser(harness.ds, 'user', 'old');

    await harness.get(HandleReconciler).forRequest(userId);
    await seedRepo(harness.ds, userId, { githubId: 1, sources: [['handle', 1]] });
    await setHandle(harness.ds, userId, 'new');
    const dropSources = jest.spyOn(harness.get(Pruner), 'dropSources');

    try {
      const results = await Promise.all([
        harness.get(HandleReconciler).forRequest(userId),
        harness.get(HandleReconciler).forRequest(userId),
      ]);

      expect(results).toEqual([{ kind: 'ok', handle: 'new' }, { kind: 'ok', handle: 'new' }]);
      expect(dropSources).toHaveBeenCalledTimes(1);
      expect(await syncStateOf(harness.ds, userId)).toMatchObject({ handle: 'new' });
    } finally {
      dropSources.mockRestore();
    }
  });
});
