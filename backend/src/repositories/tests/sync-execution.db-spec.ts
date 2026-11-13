import { githubRepo, listingPage } from '../../integrations/tests/support/github-builders.js';
import { PageWriter } from '../page-writer.js';
import { SourceRunner } from '../source-runner.js';
import { SyncFinisher } from '../sync-finisher.js';
import { SyncRunner } from '../sync-runner.js';
import { reposOf, sourcesOf, statusesOf, syncStateOf } from './support/repo-rows.js';
import { buildRepositoriesDbHarness, HARNESS_START, type RepositoriesDbHarness } from './support/repositories-db-harness.js';
import { claimRun, pastCooldown, reachCall, reconcile, ref } from './support/sync-harness.js';
import { seedTwoUserBaseline } from './support/two-user-baseline.js';

const MINUTE = 60_000;

describe('Sync execution (real MySQL)', () => {
  let harness: RepositoriesDbHarness;
  let userId: number;

  beforeEach(async () => {
    harness = await buildRepositoriesDbHarness();
    ({ userId } = await seedTwoUserBaseline(harness.ds));
    await reconcile(harness, userId);
  });

  afterEach(() => harness.close());

  it('an unexpected exception in the task releases the lock, without last_synced_at, logging safe fields', async () => {
    harness.github.setUsable(userId, [ref(5)]);
    const spy = jest.spyOn(harness.get(SourceRunner), 'run').mockRejectedValueOnce(new RangeError('CANARY detail'));
    const runId = await claimRun(harness, userId);

    try {
      await harness.get(SyncRunner).task(userId, runId)();
    } finally {
      spy.mockRestore();
    }

    expect(await syncStateOf(harness.ds, userId)).toMatchObject({ state: 'idle', run_id: null, last_synced_at: null });
    expect(harness.logger.error).toHaveBeenCalledWith('repositories sync failed', expect.objectContaining({
      userId, errorClass: 'RangeError',
    }));
    expect(JSON.stringify(harness.logger.error.mock.calls)).not.toContain('CANARY');
  });

  it('a zombie\'s exception never releases a newer run\'s lock (race)', async () => {
    harness.github.setUsable(userId, [ref(5)]);
    const held = harness.github.hold(5, 'listRepositories', 1);
    const runA = await claimRun(harness, userId);
    const zombie = harness.get(SyncRunner).task(userId, runA)();

    await reachCall(harness, (call) => call.integrationId === 5);
    pastCooldown(harness);
    const runB = await claimRun(harness, userId);
    held.reject(new Error('boom'));
    await zombie;

    expect(await syncStateOf(harness.ds, userId)).toMatchObject({ state: 'syncing', run_id: runB });
  });

  it('a zombie\'s page write is rejected by run_id: paused at GitHub, lease passed, run B started (race)', async () => {
    harness.github.setUsable(userId, [ref(5)]);
    const held = harness.github.hold(5, 'listRepositories', 1);
    const runA = await claimRun(harness, userId);
    const zombie = harness.get(SyncRunner).task(userId, runA)();

    await reachCall(harness, (call) => call.integrationId === 5);
    pastCooldown(harness);
    const runB = await claimRun(harness, userId);
    held.resolve(listingPage(1, [githubRepo({ id: 50 })]));
    await zombie;

    expect(await reposOf(harness.ds, userId)).toEqual([]);
    expect(await statusesOf(harness.ds, userId)).toEqual({});
    expect(await syncStateOf(harness.ds, userId)).toMatchObject({ state: 'syncing', run_id: runB, last_synced_at: null });
  });

  it('a zombie\'s end-of-source and end-of-sync writes are rejected by run_id', async () => {
    harness.github.setUsable(userId, [ref(5)]);
    const runA = await claimRun(harness, userId);

    pastCooldown(harness);
    const runB = await claimRun(harness, userId);
    const target = { userId, runId: runA, sourceKey: 'integration:5' };

    await expect(harness.get(PageWriter).endSource(target, { kind: 'success', lastPage: 1, status: 'ok' })).resolves.toBe('lost');
    await expect(harness.get(SyncFinisher).finish(userId, runA)).resolves.toBe(false);

    expect(await statusesOf(harness.ds, userId)).toEqual({});
    expect(await syncStateOf(harness.ds, userId)).toMatchObject({ state: 'syncing', run_id: runB, last_synced_at: null });
  });

  it('a sync stuck in syncing past its lease is taken over by the next trigger', async () => {
    const runA = await claimRun(harness, userId);

    harness.clock.advance(6 * MINUTE);
    const runB = await claimRun(harness, userId);

    expect(runB).not.toBe(runA);
  });

  it('the hard deadline stops the sync between pages, keeps applied pages, stores error for each source cut short, and ends idle', async () => {
    harness.github.setUsable(userId, [ref(5), ref(6)]);
    const held5 = harness.github.hold(5, 'listRepositories', 1);
    const held6 = harness.github.hold(6, 'listRepositories', 1);
    const runId = await claimRun(harness, userId);
    const run = harness.get(SyncRunner).task(userId, runId)();

    await reachCall(harness, (call) => call.integrationId === 6);
    harness.clock.advance(5 * MINUTE + 1000);
    held5.resolve(listingPage(1, [githubRepo({ id: 51 })], { hasNext: true }));
    held6.resolve(listingPage(1, [githubRepo({ id: 61 })], { hasNext: true }));
    await run;

    expect(harness.github.githubCalls().map((call) => call.page)).toEqual([1, 1]);
    expect(await sourcesOf(harness.ds, userId)).toEqual(['51|integration:5|1', '61|integration:6|1']);
    expect(await statusesOf(harness.ds, userId)).toMatchObject({ 'integration:5': { status: 'error' }, 'integration:6': { status: 'error' } });
    expect(await syncStateOf(harness.ds, userId)).toMatchObject({ state: 'idle', run_id: null, last_synced_at: harness.clock.now() });
    expect((await reposOf(harness.ds, userId)).map((row) => row.github_id)).toEqual(['51', '61']);
    expect(HARNESS_START.getTime()).toBeLessThan(harness.clock.now().getTime());
  });
});
