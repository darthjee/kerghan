import { RepositorySyncState } from '../entities/repository-sync-state.entity.js';
import { HandleReconciler } from '../handle-reconciler.js';
import { SyncStateStore } from '../sync-state.store.js';
import { syncStateOf } from './support/repo-rows.js';
import { buildRepositoriesDbHarness, HARNESS_START, type RepositoriesDbHarness } from './support/repositories-db-harness.js';
import { seedUser } from './support/two-user-baseline.js';

const MINUTE = 60_000;

describe('SyncStateStore (real MySQL)', () => {
  let harness: RepositoriesDbHarness;
  let store: SyncStateStore;

  beforeAll(async () => {
    harness = await buildRepositoriesDbHarness({ KERGHAN_REPOSITORIES_SYNC_TTL_MS: String(60 * MINUTE) });
    store = harness.get(SyncStateStore);
  });

  beforeEach(() => harness.clock.set(HARNESS_START));

  afterAll(() => harness.close());

  async function userWithRow(): Promise<number> {
    const userId = await seedUser(harness.ds, 'user');

    await store.ensureRow(userId);
    return userId;
  }

  async function finishRun(userId: number, runId: string): Promise<void> {
    await harness.ds.transaction((manager) => store.finish(manager, userId, runId));
  }

  describe('ensureRow', () => {
    it('creates one idle row for an existing user, idempotently', async () => {
      const userId = await seedUser(harness.ds, 'user');

      await expect(store.ensureRow(userId)).resolves.toBe(true);
      await expect(store.ensureRow(userId)).resolves.toBe(true);

      expect(await harness.ds.getRepository(RepositorySyncState).countBy({ userId })).toBe(1);
      expect(await syncStateOf(harness.ds, userId)).toMatchObject({ state: 'idle', run_id: null, last_started_at: null });
    });

    it('creates no row for a user that no longer exists', async () => {
      await expect(store.ensureRow(424242)).resolves.toBe(false);

      expect(await syncStateOf(harness.ds, 424242)).toBeUndefined();
    });
  });

  describe('claim', () => {
    it('starts a never-synced user in both modes, setting the lock and the cooldown anchor', async () => {
      const userId = await userWithRow();
      const outcome = await store.claim(userId, 'stale');

      expect(outcome.kind).toBe('started');
      expect(await syncStateOf(harness.ds, userId)).toMatchObject({
        state: 'syncing',
        run_id: (outcome as { runId: string }).runId,
        last_started_at: HARNESS_START,
        heartbeat_at: HARNESS_START,
      });
    });

    it('answers missing without a row', async () => {
      await expect(store.claim(999, 'refresh')).resolves.toEqual({ kind: 'missing' });
    });

    it('answers running while a run holds a live lease, and does not move the cooldown anchor', async () => {
      const userId = await userWithRow();

      await store.claim(userId, 'refresh');
      harness.clock.advance(MINUTE);

      await expect(store.claim(userId, 'refresh')).resolves.toEqual({ kind: 'running', startedAt: HARNESS_START });
      await expect(store.claim(userId, 'stale')).resolves.toEqual({ kind: 'running', startedAt: HARNESS_START });
      expect(await syncStateOf(harness.ds, userId)).toMatchObject({ last_started_at: HARNESS_START });
    });

    it('refuses a Refresh inside the cooldown, then allows it past the cooldown', async () => {
      const userId = await userWithRow();
      const first = await store.claim(userId, 'refresh') as { runId: string };

      harness.clock.advance(MINUTE);
      await finishRun(userId, first.runId);
      harness.clock.advance(MINUTE);

      await expect(store.claim(userId, 'refresh')).resolves.toEqual({ kind: 'cooldown', lastStartedAt: HARNESS_START });

      harness.clock.advance(4 * MINUTE);
      await expect(store.claim(userId, 'refresh')).resolves.toMatchObject({ kind: 'started' });
    });

    it('binds a stale listing by the cooldown right after a stale-triggered sync, whatever the TTL', async () => {
      const shortTtl = await buildRepositoriesDbHarness({ KERGHAN_REPOSITORIES_SYNC_TTL_MS: '1000' });

      try {
        const shortStore = shortTtl.get(SyncStateStore);
        const userId = await seedUser(shortTtl.ds, 'user');

        await shortStore.ensureRow(userId);
        const first = await shortStore.claim(userId, 'stale') as { runId: string };
        await shortTtl.ds.transaction((manager) => shortStore.finish(manager, userId, first.runId));
        shortTtl.clock.advance(2 * MINUTE);

        await expect(shortStore.claim(userId, 'stale')).resolves.toMatchObject({ kind: 'cooldown' });
      } finally {
        await shortTtl.close();
      }
    });

    it('answers fresh for a stale listing within the TTL, while a Refresh starts', async () => {
      const userId = await userWithRow();
      const first = await store.claim(userId, 'stale') as { runId: string };

      await finishRun(userId, first.runId);
      harness.clock.advance(10 * MINUTE);

      await expect(store.claim(userId, 'stale')).resolves.toEqual({ kind: 'fresh' });
      await expect(store.claim(userId, 'refresh')).resolves.toMatchObject({ kind: 'started' });
    });

    it('starts a stale listing once the TTL has passed', async () => {
      const userId = await userWithRow();
      const first = await store.claim(userId, 'stale') as { runId: string };

      await finishRun(userId, first.runId);
      harness.clock.advance(61 * MINUTE);

      await expect(store.claim(userId, 'stale')).resolves.toMatchObject({ kind: 'started' });
    });

    it('takes over a dead lease once the cooldown has passed; inside it, answers cooldown', async () => {
      const userId = await userWithRow();

      await store.claim(userId, 'refresh');
      harness.clock.advance(3 * MINUTE);

      expect((await store.readState(userId)).state).toBe('idle');
      await expect(store.claim(userId, 'refresh')).resolves.toEqual({ kind: 'cooldown', lastStartedAt: HARNESS_START });

      harness.clock.advance(3 * MINUTE);
      await expect(store.claim(userId, 'refresh')).resolves.toMatchObject({ kind: 'started' });
    });

    it('retries the claim once when the re-read finds the run ended in between', async () => {
      const userId = await userWithRow();
      const running = await store.claim(userId, 'refresh') as { runId: string };
      const repo = harness.ds.getRepository(RepositorySyncState);
      const original = repo.findOneBy.bind(repo);
      const spy = jest.spyOn(repo, 'findOneBy').mockImplementationOnce(async (where) => {
        await finishRun(userId, running.runId);
        harness.clock.advance(6 * MINUTE);
        return original(where);
      });

      try {
        await expect(store.claim(userId, 'refresh')).resolves.toMatchObject({ kind: 'started' });
        expect(spy).toHaveBeenCalledTimes(1);
      } finally {
        spy.mockRestore();
      }
    });

    it('answers cooldown when the retry loses again', async () => {
      const userId = await userWithRow();
      const repo = harness.ds.getRepository(RepositorySyncState);
      const spy = jest.spyOn(repo, 'findOneBy').mockResolvedValue({
        userId, state: 'idle', lastStartedAt: null, heartbeatAt: null, lastSyncedAt: null, runId: null,
      } as RepositorySyncState);

      await harness.ds.query("UPDATE repositories_sync_states SET state = 'syncing', heartbeat_at = ? WHERE user_id = ?",
        [HARNESS_START, userId]);
      try {
        await expect(store.claim(userId, 'refresh')).resolves.toMatchObject({ kind: 'cooldown' });
        expect(spy).toHaveBeenCalledTimes(2);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('run-guarded writes', () => {
    it('reject a zombie once run B claimed', async () => {
      const userId = await userWithRow();
      const runA = await store.claim(userId, 'refresh') as { runId: string };

      harness.clock.advance(6 * MINUTE);
      const runB = await store.claim(userId, 'refresh') as { runId: string };

      expect(runB.runId).not.toBe(runA.runId);
      await expect(store.heartbeat(userId, runA.runId)).resolves.toBe(false);
      await expect(store.release(userId, runA.runId)).resolves.toBe(false);
      await expect(harness.ds.transaction((manager) => store.finish(manager, userId, runA.runId))).resolves.toBe(false);
      expect(await syncStateOf(harness.ds, userId)).toMatchObject({ state: 'syncing', run_id: runB.runId, last_synced_at: null });
    });

    it('bump the heartbeat, release without last_synced_at, and finish with it', async () => {
      const userId = await userWithRow();
      const run = await store.claim(userId, 'refresh') as { runId: string };

      harness.clock.advance(MINUTE);
      await expect(store.heartbeat(userId, run.runId)).resolves.toBe(true);
      await expect(store.heartbeat(userId, run.runId)).resolves.toBe(true);
      expect(await syncStateOf(harness.ds, userId)).toMatchObject({ heartbeat_at: harness.clock.now() });

      await expect(store.release(userId, run.runId)).resolves.toBe(true);
      expect(await syncStateOf(harness.ds, userId)).toMatchObject({ state: 'idle', run_id: null, last_synced_at: null });

      harness.clock.advance(6 * MINUTE);
      const next = await store.claim(userId, 'refresh') as { runId: string };
      await expect(harness.ds.transaction((manager) => store.finish(manager, userId, next.runId))).resolves.toBe(true);
      expect(await syncStateOf(harness.ds, userId)).toMatchObject({ state: 'idle', run_id: null, last_synced_at: harness.clock.now() });
    });

    it('tell a changed handle from a lost run in the handle guard', async () => {
      const userId = await userWithRow();
      const run = await store.claim(userId, 'refresh') as { runId: string };

      await harness.ds.query('UPDATE repositories_sync_states SET handle = ? WHERE user_id = ?', ['new', userId]);

      await expect(harness.ds.transaction((m) => store.guard(m, userId, run.runId, { handle: 'new' }))).resolves.toBe('owned');
      await expect(harness.ds.transaction((m) => store.guard(m, userId, run.runId, { handle: 'old' }))).resolves.toBe('handle_changed');
      await expect(harness.ds.transaction((m) => store.guard(m, userId, run.runId, { handle: null }))).resolves.toBe('handle_changed');
      await expect(harness.ds.transaction((m) => store.guard(m, userId, 'other', { handle: 'new' }))).resolves.toBe('lost');
    });

    it('affect nothing once the row was deleted', async () => {
      const userId = await userWithRow();
      const run = await store.claim(userId, 'refresh') as { runId: string };

      await harness.ds.query('DELETE FROM repositories_sync_states WHERE user_id = ?', [userId]);

      await expect(store.heartbeat(userId, run.runId)).resolves.toBe(false);
      await expect(store.release(userId, run.runId)).resolves.toBe(false);
      expect(await syncStateOf(harness.ds, userId)).toBeUndefined();
    });
  });

  describe('readState', () => {
    it('reports no row, a live run and a dead lease (as idle)', async () => {
      const userId = await seedUser(harness.ds, 'user');

      expect(await store.readState(userId)).toMatchObject({ exists: false, state: 'idle' });
      await store.ensureRow(userId);
      await store.claim(userId, 'refresh');
      expect(await store.readState(userId)).toMatchObject({ exists: true, state: 'syncing', lastStartedAt: HARNESS_START });

      harness.clock.advance(2 * MINUTE + 1000);
      expect(await store.readState(userId)).toMatchObject({ state: 'idle' });
    });
  });

  it('a run reconciliation never creates the row', async () => {
    const userId = await seedUser(harness.ds, 'user', 'someone');

    await expect(harness.get(HandleReconciler).forRun(userId)).resolves.toEqual({ kind: 'no_row' });
    expect(await syncStateOf(harness.ds, userId)).toBeUndefined();
  });
});
