import { EventEmitter2 } from '@nestjs/event-emitter';
import { USER_DELETED, UserDeletedEvent } from '../../auth/events/user-deleted.event.js';
import {
  githubIssue, issue as issueCase, issuePage, notFound,
} from '../../integrations/tests/support/github-builders.js';
import { deferred } from '../../integrations/tests/support/no-network-guard.js';
import { IssueLinksService } from '../issue-links.service.js';
import { IssueSyncCommit } from '../issue-sync-commit.js';
import { IssueSyncQueue } from '../issue-sync-queue.js';
import { IssuesService } from '../issues.service.js';
import { ISSUES_RECONCILE_JOB } from '../jobs/issues-reconcile.job.js';
import { ProjectsService } from '../projects.service.js';
import { buildIssuesDbHarness, type IssuesDbHarness } from './support/issues-db-harness.js';
import {
  buildSyncWorld, githubCase, readState, scriptGet, SYNC_INTEGRATION, SYNC_NUMBER, uuidsOf, type SyncWorld, type SyncWorldOptions,
} from './support/sync-fixture.js';

const LATER = new Date('2026-06-01T13:00:00Z');
const PUT_AT = new Date('2026-06-01T14:00:00Z');

type Operation = 'getIssue' | 'updateIssue';

// `(race)`: scripted interleavings. A deferred GitHub answer (`hold`) pauses the job at its GET or
// PATCH, the competing action runs to completion, the answer is released and the invariant is
// asserted. Nothing loops or sleeps: the spec learns that the job reached the call from a spy.
describe('Issues sync races (real MySQL)', () => {
  let harness: IssuesDbHarness;

  beforeAll(async () => {
    harness = await buildIssuesDbHarness();
  });

  afterAll(() => harness.close());

  afterEach(() => jest.restoreAllMocks());

  const jobs = () => harness.workers.paramsOf(ISSUES_RECONCILE_JOB);
  const puts = () => harness.github.githubCalls().filter((call) => call.operation === 'updateIssue');
  const putAnswer = (title: string) => issueCase(githubIssue({ number: SYNC_NUMBER, title, updatedAt: PUT_AT }));
  const counts = async (): Promise<Record<string, number>> => {
    const result: Record<string, number> = {};

    for (const table of ['issues', 'issues_github_links', 'issues_pending_writes']) {
      const rows: Array<{ total: string }> = await harness.ds.query(`SELECT COUNT(*) AS total FROM ${table}`);

      result[table] = Number(rows[0].total);
    }

    return result;
  };

  /** Resolves once the GitHub fake has received `count` calls of the operation. */
  function reached(operation: Operation, count = 1): Promise<void> {
    const signal = deferred<void>();
    const target = harness.github as unknown as Record<Operation, (...args: unknown[]) => unknown>;
    const original = target[operation].bind(harness.github);
    let seen = 0;

    jest.spyOn(target, operation).mockImplementation(((...args: unknown[]) => {
      seen += 1;
      if (seen >= count) signal.resolve();

      return original(...args);
    }) as never);

    return signal.promise;
  }

  /** Starts the world's job and returns once it is parked on the held call. */
  async function startAt(world: SyncWorld, operation: Operation): Promise<{ finished: Promise<void> }> {
    const arrival = reached(operation);

    harness.get(IssueSyncQueue).enqueue(world.linkId);

    const finished = harness.workers.runNext();

    await arrival;

    return { finished };
  }

  async function raceWorld(options: SyncWorldOptions = {}) {
    const world = await buildSyncWorld(harness, options);

    return { world, uuids: await uuidsOf(harness, world) };
  }

  describe('E41: an edit during a push', () => {
    it('keeps the marker at the new revision, commits only the push effects, re-enqueues once, and pushes the edit next', async () => {
      const { world, uuids } = await raceWorld({ local: { title: 'L1' }, base: {}, marker: { revision: 1 } });
      const held = harness.github.hold(SYNC_INTEGRATION, 'updateIssue', SYNC_NUMBER);

      scriptGet(harness, SYNC_INTEGRATION, githubCase());

      const { finished } = await startAt(world, 'updateIssue');

      await harness.get(IssuesService).edit(world.userId, uuids.project, uuids.issue, { title: 'L2' });
      held.resolve(putAnswer('L1'));
      await finished;

      const mid = await readState(harness, world);

      expect(harness.workers.errors).toEqual([]);
      expect(mid.issue.title).toBe('L2');
      expect(mid.link.baseTitle).toBe('L1');
      expect(mid.marker?.revision).toBe(2);
      // The edit's own T1 job is waiting; the job's re-enqueue (T6) went through the dedupe and added none.
      expect(harness.workers.queued).toBe(1);

      // The re-enqueued job sees GitHub at L1 (the base) and pushes L2.
      scriptGet(harness, SYNC_INTEGRATION, githubCase({ title: 'L1', updatedAt: PUT_AT }));
      harness.github.script(SYNC_INTEGRATION, 'updateIssue', SYNC_NUMBER, putAnswer('L2'));
      await harness.workers.runAll();

      const end = await readState(harness, world);

      expect(puts().map((call) => call.changes)).toEqual([{ title: 'L1' }, { title: 'L2' }]);
      expect(end.link.baseTitle).toBe('L2');
      expect(end.marker).toBeNull();
    });
  });

  describe('E10: an edit during a refresh', () => {
    it('skips every pulled field, keeps the marker, re-enqueues, and the next run pulls and pushes', async () => {
      const { world, uuids } = await raceWorld();
      const held = harness.github.hold(SYNC_INTEGRATION, 'getIssue', SYNC_NUMBER);
      const { finished } = await startAt(world, 'getIssue');

      await harness.get(IssuesService).edit(world.userId, uuids.project, uuids.issue, { body: 'edited body' });
      held.resolve(githubCase({ title: 'G', updatedAt: LATER }, 'W/"fresh"'));
      await finished;

      const mid = await readState(harness, world);

      expect(mid.issue).toMatchObject({ title: 'T', body: 'edited body' });
      expect(mid.link).toMatchObject({ baseTitle: 'T', etag: null });
      expect(mid.marker).not.toBeNull();
      expect(harness.workers.queued).toBe(1);

      scriptGet(harness, SYNC_INTEGRATION, githubCase({ title: 'G', updatedAt: LATER }));
      harness.github.script(SYNC_INTEGRATION, 'updateIssue', SYNC_NUMBER, issueCase(githubIssue({ number: SYNC_NUMBER, title: 'G', body: 'edited body', updatedAt: PUT_AT })));
      await harness.workers.runAll();

      const end = await readState(harness, world);

      expect(puts().map((call) => call.changes)).toEqual([{ body: 'edited body' }]);
      expect(end.issue).toMatchObject({ title: 'G', body: 'edited body' });
      expect(end.link).toMatchObject({ baseTitle: 'G', baseBody: 'edited body' });
      expect(end.marker).toBeNull();
    });
  });

  describe('E44 and E32: an unlink, a project delete or a user delete during a push', () => {
    it.each([
      ['unlink', async (world: SyncWorld, uuids: { project: string; issue: string }) => {
        await harness.get(IssueLinksService).unlink(world.userId, uuids.project, uuids.issue, { discardUnsentChanges: true });
      }, { issues: 1, issues_github_links: 0, issues_pending_writes: 0 }],
      ['project delete', async (world: SyncWorld, uuids: { project: string; issue: string }) => {
        await harness.get(ProjectsService).delete(world.userId, uuids.project);
      }, { issues: 0, issues_github_links: 0, issues_pending_writes: 0 }],
      ['user delete', async (world: SyncWorld) => {
        await harness.get(EventEmitter2).emitAsync(USER_DELETED, new UserDeletedEvent(world.userId));
      }, { issues: 0, issues_github_links: 0, issues_pending_writes: 0 }],
    ])('%s: the commit writes nothing, inserts nothing, and the job ends without an error or a new job', async (_label, act, expected) => {
      const { world, uuids } = await raceWorld({ local: { title: 'L' }, base: {}, marker: {} });
      const held = harness.github.hold(SYNC_INTEGRATION, 'updateIssue', SYNC_NUMBER);

      scriptGet(harness, SYNC_INTEGRATION, githubCase());

      const { finished } = await startAt(world, 'updateIssue');

      await act(world, uuids);
      held.resolve(putAnswer('L'));
      await finished;

      expect(harness.workers.errors).toEqual([]);
      expect(await counts()).toEqual(expected);
      expect(harness.workers.queued).toBe(0);
    });
  });

  describe('E1: an edit against the job that sets gone', () => {
    it('leaves the link gone with no marker, keeps the edit, and the queued job stops at the guard with no call', async () => {
      const { world, uuids } = await raceWorld();
      const held = harness.github.hold(SYNC_INTEGRATION, 'getIssue', SYNC_NUMBER);

      harness.github.script(SYNC_INTEGRATION, 'probeIssues', 0, issuePage([]));

      const { finished } = await startAt(world, 'getIssue');

      await harness.get(IssuesService).edit(world.userId, uuids.project, uuids.issue, { title: 'edited' });
      expect((await readState(harness, world)).marker).not.toBeNull();

      held.resolve(notFound());
      await finished;

      const state = await readState(harness, world);

      expect(state.link).toMatchObject({ status: 'gone', statusReason: 'deleted' });
      expect(state.marker).toBeNull();
      expect(state.issue.title).toBe('edited');

      harness.github.calls.length = 0;
      await harness.workers.runAll();
      await harness.get(IssuesService).edit(world.userId, uuids.project, uuids.issue, { title: 'edited again' });

      expect(harness.github.githubCalls()).toEqual([]);
      expect((await readState(harness, world)).marker).toBeNull();
      // Only the first job and the first edit's job were ever enqueued: a gone link gets no trigger.
      expect(jobs()).toHaveLength(2);
    });
  });

  describe('E13: duplicate jobs', () => {
    it('both push the same fixed-value diff; the first clears the marker, the second finds it gone and finishes with no new job', async () => {
      const { world } = await raceWorld({ local: { title: 'L' }, base: {}, marker: {} });
      const first = harness.github.hold(SYNC_INTEGRATION, 'updateIssue', SYNC_NUMBER);
      const second = harness.github.hold(SYNC_INTEGRATION, 'updateIssue', SYNC_NUMBER);
      const both = reached('updateIssue', 2);

      scriptGet(harness, SYNC_INTEGRATION, githubCase());
      // Two instances (or a retry) can each hold a job for the link; the dedupe is not a correctness rule.
      harness.workers.enqueue(ISSUES_RECONCILE_JOB, { linkId: world.linkId });
      harness.workers.enqueue(ISSUES_RECONCILE_JOB, { linkId: world.linkId });

      const runs = [harness.workers.runNext(), harness.workers.runNext()];

      await both;
      first.resolve(putAnswer('L'));
      second.resolve(putAnswer('L'));
      await Promise.all(runs);

      const state = await readState(harness, world);

      expect(harness.workers.errors).toEqual([]);
      expect(puts().map((call) => call.changes)).toEqual([{ title: 'L' }, { title: 'L' }]);
      expect(state.link).toMatchObject({ baseTitle: 'L', status: 'linked' });
      expect(state.marker).toBeNull();
      expect(harness.workers.queued).toBe(0);
    });
  });

  describe('E15: a crash before the clear', () => {
    it('leaves the marker, and the retry finds GitHub already at the pushed value: no second PATCH, the marker clears', async () => {
      const { world } = await raceWorld({ local: { title: 'L' }, base: {}, marker: {} });

      scriptGet(harness, SYNC_INTEGRATION, githubCase());
      harness.github.script(SYNC_INTEGRATION, 'updateIssue', SYNC_NUMBER, putAnswer('L'));
      jest.spyOn(harness.get(IssueSyncCommit), 'apply').mockRejectedValueOnce(new Error('crash'));

      harness.workers.enqueue(ISSUES_RECONCILE_JOB, { linkId: world.linkId });
      await harness.workers.runAll();

      const crashed = await readState(harness, world);

      expect(harness.workers.errors).toEqual([new Error('issues reconcile failed')]);
      expect(puts()).toHaveLength(1);
      expect(crashed.marker).not.toBeNull();
      expect(crashed.link.baseTitle).toBe('T');

      // The retry: GitHub already holds L, so both sides agree (E8): nothing is sent.
      scriptGet(harness, SYNC_INTEGRATION, githubCase({ title: 'L', updatedAt: PUT_AT }));
      harness.workers.enqueue(ISSUES_RECONCILE_JOB, { linkId: world.linkId });
      await harness.workers.runAll();

      const end = await readState(harness, world);

      expect(puts()).toHaveLength(1);
      expect(end.link.baseTitle).toBe('L');
      expect(end.marker).toBeNull();
    });
  });

  it('a pull and a push of different fields in one run do not interfere (idempotence of a repeated run)', async () => {
    const { world } = await raceWorld({ local: { title: 'L' }, base: {}, marker: {} });

    scriptGet(harness, SYNC_INTEGRATION, githubCase({ body: 'G body', updatedAt: LATER }));
    harness.github.script(SYNC_INTEGRATION, 'updateIssue', SYNC_NUMBER, putAnswer('L'));
    harness.workers.enqueue(ISSUES_RECONCILE_JOB, { linkId: world.linkId });
    await harness.workers.runAll();

    const once = await readState(harness, world);

    scriptGet(harness, SYNC_INTEGRATION, githubCase({ title: 'L', body: 'G body', updatedAt: PUT_AT }));
    harness.workers.enqueue(ISSUES_RECONCILE_JOB, { linkId: world.linkId });
    await harness.workers.runAll();

    const twice = await readState(harness, world);

    expect(once.issue).toMatchObject({ title: 'L', body: 'G body' });
    expect(twice.issue).toMatchObject({ title: 'L', body: 'G body' });
    expect(twice.link).toMatchObject({ baseTitle: 'L', baseBody: 'G body' });
    expect(puts()).toHaveLength(1);
    expect(twice.marker).toBeNull();
  });
});
