import { githubIssue, issue as issueCase } from '../../integrations/tests/support/github-builders.js';
import { IssueRateLimitPauses } from '../issue-rate-limit-pauses.js';
import { IssueSyncQueue } from '../issue-sync-queue.js';
import { IssuesSyncBootstrap } from '../issues-sync.bootstrap.js';
import { ISSUES_RECONCILE_JOB } from '../jobs/issues-reconcile.job.js';
import { integrationRef } from './support/integration-refs.js';
import { buildIssuesDbHarness, type IssuesDbHarness } from './support/issues-db-harness.js';
import { seedIssue, seedLink, seedMarker } from './support/issues-seeds.js';
import {
  buildSyncWorld, githubCase, readState, scriptGet, SYNC_INTEGRATION, SYNC_NUMBER, SYNC_REPOSITORY, SYNC_REPOSITORY_ID, type SyncWorld,
} from './support/sync-fixture.js';

// Restart (E14, E51, E16) `(db)`: a fresh module over the same database with a new `FakeWorkersService`
// stands for the restarted process: the old in-memory queue, pauses and waiting sets are gone, and the
// boot hook (T5) re-enqueues every marker. There is no real-engine restart variant.
describe('Issues sync restart (real MySQL)', () => {
  let before: IssuesDbHarness;
  let restarted: IssuesDbHarness | undefined;

  beforeAll(async () => {
    before = await buildIssuesDbHarness();
  });

  afterAll(async () => {
    await before.close();
  });

  afterEach(async () => {
    await restarted?.close();
    restarted = undefined;
  });

  /** The process restarts: a new module over the same rows boots, and its boot sweep runs in `init()`. */
  async function restart(): Promise<IssuesDbHarness> {
    restarted = await buildIssuesDbHarness();

    return restarted;
  }

  /** The restarted module's in-memory Repositories and GitHub state (not persisted, so each spec seeds it). */
  function seedMemory(after: IssuesDbHarness, userId: number, status: 'added' | 'unavailable' = 'added'): void {
    after.repositories.seed(userId, { repositoryId: SYNC_REPOSITORY_ID, ...SYNC_REPOSITORY, status, integrationSourceIds: [SYNC_INTEGRATION] });
    after.github.setUsable(userId, [integrationRef(SYNC_INTEGRATION)]);
  }

  const jobs = (harness: IssuesDbHarness) => harness.workers.paramsOf(ISSUES_RECONCILE_JOB);

  /** Seeds a marker per entry (`marked_at` hour), on its own issue and link of the world's project. */
  async function seedMarkers(hours: number[]): Promise<number[]> {
    return (await seedMarkersOf(hours)).links;
  }

  async function seedMarkersOf(hours: number[]): Promise<{ world: SyncWorld; links: number[] }> {
    const world = await buildSyncWorld(before);
    const links: number[] = [];

    for (const hour of hours) {
      const issue = await seedIssue(before.ds, world.projectId, { title: `T${hour}` });
      const link = await seedLink(before.ds, { userId: world.userId, issueId: issue.id, githubNumber: SYNC_NUMBER });

      await seedMarker(before.ds, link.id, { markedAt: new Date(Date.UTC(2026, 5, 1, hour)) });
      links.push(link.id);
    }

    return { world, links };
  }

  it('E14: enqueues each marker exactly once, oldest marked_at first', async () => {
    const [late, early, middle] = await seedMarkers([14, 6, 10]);
    const after = await restart();

    expect(jobs(after)).toEqual([{ linkId: early }, { linkId: middle }, { linkId: late }]);
  });

  it('a second job for the same link is a no-op: the boot hook run again enqueues nothing', async () => {
    await seedMarkers([6, 10]);

    const after = await restart();

    await after.get(IssuesSyncBootstrap).onApplicationBootstrap();
    await after.get(IssuesSyncBootstrap).onApplicationBootstrap();

    expect(jobs(after)).toHaveLength(2);
  });

  it('E51: the old module\'s queue is gone with it: only the markers come back', async () => {
    const { world, links: [kept] } = await seedMarkersOf([8]);
    const unmarkedIssue = await seedIssue(before.ds, world.projectId, { title: 'No marker' });
    const unmarked = await seedLink(before.ds, { userId: world.userId, issueId: unmarkedIssue.id });

    // The old process had a queued refresh for a link with no marker (and one for the marked link).
    before.get(IssueSyncQueue).enqueue(unmarked.id);
    before.get(IssueSyncQueue).enqueue(kept);

    const after = await restart();

    expect(jobs(after)).toEqual([{ linkId: kept }]);
  });

  it('E16: a waiting refresh with no marker and the pauses are lost; the first call that hits the limit pauses again', async () => {
    const world = await buildSyncWorld(before);

    before.get(IssueRateLimitPauses).pause(SYNC_INTEGRATION, new Date(before.clock.now().getTime() + 600_000));
    before.get(IssueRateLimitPauses).wait(SYNC_INTEGRATION, world.linkId);

    const after = await restart();

    expect(jobs(after)).toEqual([]);
    expect(after.get(IssueRateLimitPauses).isPaused(SYNC_INTEGRATION)).toBe(false);
    expect(after.get(IssueRateLimitPauses).untilFor([world.linkId]).size).toBe(0);
  });

  it('the boot sweep stops at the guards with no GitHub call: a marker of a repository that is Unavailable is kept', async () => {
    const world = await buildSyncWorld(before, { local: { title: 'L' }, marker: {} });
    const after = await restart();

    seedMemory(after, world.userId, 'unavailable');
    await after.workers.runAll();

    expect(after.github.githubCalls()).toEqual([]);
    expect((await readState(after, world)).marker).not.toBeNull();
  });

  it('the re-enqueued marker is pushed once the restarted module runs it (one attempt per boot)', async () => {
    const world = await buildSyncWorld(before, { local: { title: 'L' }, marker: {} });
    const after = await restart();

    seedMemory(after, world.userId);
    scriptGet(after, SYNC_INTEGRATION, githubCase());
    after.github.script(SYNC_INTEGRATION, 'updateIssue', SYNC_NUMBER, issueCase(githubIssue({ number: SYNC_NUMBER, title: 'L' })));
    await after.workers.runAll();

    expect(after.github.githubCalls().map((call) => call.operation)).toEqual(['getIssue', 'updateIssue']);
    expect((await readState(after, world)).marker).toBeNull();
  });
});
