import { githubRepo, listingPage } from '../../integrations/tests/support/github-builders.js';
import { RepositoriesService } from '../repositories.service.js';
import { reposOf, seedStatus, seedSyncState, syncStateOf } from './support/repo-rows.js';
import { buildRepositoriesDbHarness, HARNESS_START, type RepositoriesDbHarness } from './support/repositories-db-harness.js';
import { ref } from './support/sync-harness.js';
import { seedUser } from './support/two-user-baseline.js';

const MINUTE = 60_000;
const at = (minutes: number): Date => new Date(HARNESS_START.getTime() + minutes * MINUTE);

describe('RepositoriesService sync state and triggers (real MySQL)', () => {
  let harness: RepositoriesDbHarness;
  let service: RepositoriesService;
  let userId: number;

  beforeEach(async () => {
    harness = await buildRepositoriesDbHarness();
    service = harness.get(RepositoriesService);
    userId = await seedUser(harness.ds, 'owner', 'darthjee');
  });

  afterEach(() => harness.close());

  describe('syncState', () => {
    it('reports every current source, pending with no status row, and a fixed integration as pending', async () => {
      await seedSyncState(harness.ds, userId, { handle: 'darthjee', last_started_at: at(-2), last_synced_at: at(-1) });
      harness.github.setUsable(userId, [ref(1), ref(2)]).setIntegrations(userId, [ref(1), ref(2), ref(3), ref(4)]);
      await seedStatus(harness.ds, userId, 'integration:1', 'invalid_credentials');
      await seedStatus(harness.ds, userId, 'integration:3', 'invalid_credentials');
      await seedStatus(harness.ds, userId, 'integration:4', 'error', at(30));
      await seedStatus(harness.ds, userId, 'handle', 'rate_limited', at(30));
      await seedStatus(harness.ds, userId, 'integration:9', 'ok');

      const state = await service.syncState(userId);

      expect(state).toEqual({
        state: 'idle',
        startedAt: null,
        lastSyncedAt: at(-1),
        refreshAvailableAt: at(3),
        sources: [
          { kind: 'integration', integration: { uuid: 'uuid-1', label: 'label-1' }, status: 'pending', syncedAt: null, resetAt: null },
          { kind: 'integration', integration: { uuid: 'uuid-2', label: 'label-2' }, status: 'pending', syncedAt: null, resetAt: null },
          {
            kind: 'integration', integration: { uuid: 'uuid-3', label: 'label-3' },
            status: 'invalid_credentials', syncedAt: expect.any(Date), resetAt: null,
          },
          { kind: 'integration', integration: { uuid: 'uuid-4', label: 'label-4' }, status: 'error', syncedAt: expect.any(Date), resetAt: null },
          { kind: 'handle', handle: 'darthjee', status: 'rate_limited', syncedAt: expect.any(Date), resetAt: at(30) },
        ],
      });
      expect(harness.github.githubCalls()).toEqual([]);
      expect(harness.launcher.launched).toBe(0);
    });

    it('reads a live run as syncing, a dead lease as idle, and a never-synced user with no Refresh wait', async () => {
      expect(await service.syncState(userId)).toEqual({
        state: 'idle', startedAt: null, lastSyncedAt: null, refreshAvailableAt: null, sources: [],
      });

      await seedSyncState(harness.ds, userId, { state: 'syncing', run_id: 'r', last_started_at: at(0), heartbeat_at: at(0) });
      expect(await service.syncState(userId)).toMatchObject({ state: 'syncing', startedAt: at(0), refreshAvailableAt: at(5) });

      harness.clock.advance(3 * MINUTE);
      expect(await service.syncState(userId)).toMatchObject({ state: 'idle', startedAt: null, refreshAvailableAt: at(5) });

      harness.clock.advance(3 * MINUTE);
      expect(await service.syncState(userId)).toMatchObject({ state: 'idle', refreshAvailableAt: null });
    });
  });

  describe('triggers', () => {
    beforeEach(() => {
      harness.github.setUsable(userId, [ref(1)]);
      harness.github.script(1, 'listRepositories', 1, listingPage(1, [githubRepo({ id: 77 })]));
      harness.github.script(null, 'listHandleRepositories', 1, listingPage(1, []));
      harness.github.script(1, 'listHandleRepositories', 1, listingPage(1, []));
    });

    it('a stale listing starts a sync and returns before the captured task runs, with no GitHub call', async () => {
      expect(await service.triggerIfStale(userId)).toEqual({ kind: 'started' });
      expect(await syncStateOf(harness.ds, userId)).toMatchObject({ state: 'syncing', handle: 'darthjee' });
      expect((await service.syncState(userId)).state).toBe('syncing');
      expect(harness.github.githubCalls()).toEqual([]);
      expect(harness.launcher.launched).toBe(1);

      await harness.launcher.runAll();

      expect((await reposOf(harness.ds, userId)).map((row) => row.github_id)).toEqual(['77']);
      expect(await service.syncState(userId)).toMatchObject({ state: 'idle', lastSyncedAt: at(0) });
    });

    it('answers running during a sync, then cooldown with its end, then fresh for a stale listing within the TTL', async () => {
      await service.refresh(userId);

      expect(await service.refresh(userId)).toEqual({ kind: 'running', startedAt: at(0) });
      await harness.launcher.runAll();
      expect(await service.refresh(userId)).toEqual({ kind: 'cooldown', lastStartedAt: at(0), refreshAvailableAt: at(5) });
      expect(await service.triggerIfStale(userId)).toMatchObject({ kind: 'cooldown' });

      harness.clock.advance(6 * MINUTE);
      expect(await service.triggerIfStale(userId)).toEqual({ kind: 'fresh' });
      expect(await service.refresh(userId)).toEqual({ kind: 'started' });
      expect(harness.launcher.launched).toBe(2);
    });

    it('creates nothing and starts nothing for a user that no longer exists', async () => {
      expect(await service.refresh(999_999)).toEqual({ kind: 'no_user' });
      expect(await service.reconcileForRequest(999_999)).toEqual({ kind: 'no_user' });
      expect(await syncStateOf(harness.ds, 999_999)).toBeUndefined();
      expect(harness.launcher.launched).toBe(0);
    });

    it('reconcileForRequest creates the row and stores the handle without starting a sync', async () => {
      expect(await service.reconcileForRequest(userId)).toEqual({ kind: 'ok', handle: 'darthjee' });
      expect(await syncStateOf(harness.ds, userId)).toMatchObject({ state: 'idle', handle: 'darthjee', last_started_at: null });
      expect(harness.launcher.launched).toBe(0);
    });
  });
});
