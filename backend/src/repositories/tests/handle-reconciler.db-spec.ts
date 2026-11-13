import { HandleReconciler } from '../handle-reconciler.js';
import { SyncStateStore } from '../sync-state.store.js';
import { pagesOf, reposOf, seedPage, seedRepo, seedStatus, sourcesOf, statusesOf, syncStateOf } from './support/repo-rows.js';
import { buildRepositoriesDbHarness, HARNESS_START, type RepositoriesDbHarness } from './support/repositories-db-harness.js';
import { seedIntegration, seedTwoUserBaseline, setHandle, snapshotUserRows } from './support/two-user-baseline.js';

const ADDED = new Date('2026-05-02T00:00:00Z');

describe('HandleReconciler (real MySQL)', () => {
  let harness: RepositoriesDbHarness;
  let reconciler: HandleReconciler;

  beforeAll(async () => {
    harness = await buildRepositoriesDbHarness();
    reconciler = harness.get(HandleReconciler);
  });

  beforeEach(() => harness.clock.set(HARNESS_START));

  afterAll(() => harness.close());

  /** The user with handle `old` reconciled, holding handle and integration rows. */
  async function seedOldHandle(): Promise<{ userId: number; intruderId: number; key: string }> {
    const { userId, intruderId } = await seedTwoUserBaseline(harness.ds, { handle: 'old' });
    const integrationId = await seedIntegration(harness.ds, userId);
    const key = `integration:${integrationId}`;

    await harness.get(SyncStateStore).ensureRow(userId);
    await harness.ds.query("UPDATE repositories_sync_states SET handle = 'old', last_started_at = ? WHERE user_id = ?",
      [HARNESS_START, userId]);
    await seedRepo(harness.ds, userId, { githubId: 1, sources: [['handle', 1]] });
    await seedRepo(harness.ds, userId, { githubId: 2, addedAt: ADDED, sources: [['handle', 1]] });
    await seedRepo(harness.ds, userId, { githubId: 3, sources: [['handle', 1], [key, 1]] });
    await seedPage(harness.ds, userId, 'handle', 1);
    await seedPage(harness.ds, userId, key, 1);
    await seedStatus(harness.ds, userId, 'handle', 'ok');
    await seedStatus(harness.ds, userId, key, 'ok');

    return { userId, intruderId, key };
  }

  it('on a handle change, drops the handle rows, stores the handle and prunes', async () => {
    const { userId, intruderId, key } = await seedOldHandle();
    const intruderBefore = await snapshotUserRows(harness.ds, intruderId);

    await setHandle(harness.ds, userId, 'new');
    await expect(reconciler.forRequest(userId)).resolves.toEqual({ kind: 'ok', handle: 'new' });

    expect((await reposOf(harness.ds, userId)).map((row) => row.github_id)).toEqual(['2', '3']);
    expect(await sourcesOf(harness.ds, userId)).toEqual([`3|${key}|1`]);
    expect(await pagesOf(harness.ds, userId)).toEqual([`${key}|1|W/"${key}-1"|false`]);
    expect(Object.keys(await statusesOf(harness.ds, userId))).toEqual([key]);
    expect(await syncStateOf(harness.ds, userId)).toMatchObject({ handle: 'new', last_started_at: HARNESS_START });
    expect(await snapshotUserRows(harness.ds, intruderId)).toEqual(intruderBefore);
    expect(harness.launcher.launched).toBe(0);
    expect(harness.github.githubCalls()).toEqual([]);
  });

  it('on a cleared handle, leaves no handle source', async () => {
    const { userId } = await seedOldHandle();

    await setHandle(harness.ds, userId, null);
    await expect(reconciler.forRequest(userId)).resolves.toEqual({ kind: 'ok', handle: null });

    expect((await sourcesOf(harness.ds, userId)).filter((row) => row.includes('|handle|'))).toEqual([]);
    expect(await syncStateOf(harness.ds, userId)).toMatchObject({ handle: null });
  });

  it('is a no-op for an unchanged handle (a case-only edit stores the same normalised value)', async () => {
    const { userId } = await seedOldHandle();
    const before = await snapshotUserRows(harness.ds, userId);

    await expect(reconciler.forRequest(userId)).resolves.toEqual({ kind: 'ok', handle: 'old' });
    await expect(reconciler.forRun(userId)).resolves.toEqual({ kind: 'ok', handle: 'old' });

    expect(await snapshotUserRows(harness.ds, userId)).toEqual(before);
  });

  it('reconciles at the start of a run on an existing row', async () => {
    const { userId } = await seedOldHandle();

    await setHandle(harness.ds, userId, 'new');
    await expect(reconciler.forRun(userId)).resolves.toEqual({ kind: 'ok', handle: 'new' });

    expect(await syncStateOf(harness.ds, userId)).toMatchObject({ handle: 'new' });
  });

  it('creates the row for a request, storing the current handle', async () => {
    const { userId } = await seedTwoUserBaseline(harness.ds, { handle: 'mine' });

    await expect(reconciler.forRequest(userId)).resolves.toEqual({ kind: 'ok', handle: 'mine' });
    expect(await syncStateOf(harness.ds, userId)).toMatchObject({ state: 'idle', handle: 'mine' });
  });

  it('creates the row for a request with no handle', async () => {
    const { userId } = await seedTwoUserBaseline(harness.ds);

    await expect(reconciler.forRequest(userId)).resolves.toEqual({ kind: 'ok', handle: null });
    expect(await syncStateOf(harness.ds, userId)).toMatchObject({ handle: null });
  });

  it('creates no row for a user that no longer exists', async () => {
    await expect(reconciler.forRequest(98765)).resolves.toEqual({ kind: 'no_user' });
    expect(await syncStateOf(harness.ds, 98765)).toBeUndefined();
  });

  it('a run never creates the row, even when the handle differs', async () => {
    const { userId } = await seedTwoUserBaseline(harness.ds, { handle: 'mine' });

    await expect(reconciler.forRun(userId)).resolves.toEqual({ kind: 'no_row' });
    expect(await syncStateOf(harness.ds, userId)).toBeUndefined();
  });

  it('a run stops when the row disappears before its lock', async () => {
    const { userId } = await seedOldHandle();

    await setHandle(harness.ds, userId, 'new');
    const spy = jest.spyOn(harness.ds, 'transaction').mockImplementationOnce(async (...args: unknown[]) => {
      await harness.ds.query('DELETE FROM repositories_sync_states WHERE user_id = ?', [userId]);
      spy.mockRestore();
      return (harness.ds.transaction as (...a: unknown[]) => Promise<unknown>)(...args);
    });

    await expect(reconciler.forRun(userId)).resolves.toEqual({ kind: 'no_row' });
    expect(await syncStateOf(harness.ds, userId)).toBeUndefined();
  });
});
