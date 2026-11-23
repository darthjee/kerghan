import { HttpException, NotFoundException } from '@nestjs/common';
import { ErrorCodes } from '../../core/error-codes.js';
import { seedUser } from '../../repositories/tests/support/two-user-baseline.js';
import { Issue, type IssueState } from '../entities/issue.entity.js';
import { IssueEditRateLimiter } from '../issue-edit-rate-limiter.js';
import { IssueMarkers } from '../issue-markers.js';
import { IssueRateLimitPauses } from '../issue-rate-limit-pauses.js';
import { IssueStore } from '../issue-store.js';
import { IssueSyncTrigger } from '../issue-sync-trigger.js';
import { IssuesAccess } from '../issues-access.js';
import { ISSUES_RECONCILE_JOB } from '../jobs/issues-reconcile.job.js';
import { IssuesService } from '../issues.service.js';
import { integrationRef } from './support/integration-refs.js';
import { buildIssuesDbHarness, HARNESS_START, type IssuesDbHarness } from './support/issues-db-harness.js';
import { seedIssue, seedLink, seedMarker, seedProject, SEED_TIME, type SeededProject } from './support/issues-seeds.js';
import { releaseQueuedLinks } from './support/sync-fixture.js';

interface MarkerRow {
  link_id: number;
  revision: number;
  marked_at: Date;
  updated_at: Date;
}

const INTEGRATION = 41;

describe('IssuesService#bulkState (real MySQL)', () => {
  let harness: IssuesDbHarness;
  let service: IssuesService;
  let userId: number;
  let project: SeededProject;
  let trigger: jest.SpyInstance;
  let run = 0;

  beforeAll(async () => {
    harness = await buildIssuesDbHarness();
    service = harness.get(IssuesService);
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    jest.restoreAllMocks();
    releaseQueuedLinks(harness);
    trigger = jest.spyOn(harness.get(IssueSyncTrigger), 'afterCommit');
    userId = await seedUser(harness.ds, 'owner');
    project = await seedProject(harness.ds, userId);
    run += 1;
    harness.clock.set(new Date(HARNESS_START.getTime() + run * 3_600_000 + 123));
  });

  const issueIn = (state: IssueState, projectId = project.id): ReturnType<typeof seedIssue> => seedIssue(harness.ds, projectId, { state });
  const stored = (id: number): Promise<Issue> => harness.ds.getRepository(Issue).findOneByOrFail({ id });
  const markers = (): Promise<MarkerRow[]> => harness.ds.query('SELECT link_id, revision, marked_at, updated_at FROM issues_pending_writes WHERE link_id <> ? ORDER BY link_id', [harness.intruder.linkId]);
  const bulk = (issueIds: string[], state: IssueState, project_ = project) => service.bulkState(userId, project_.uuid, { issueIds, state });

  it('splits the ids into changed, unchanged and notFound, in request order', async () => {
    const open = await issueIn('open');
    const closed = await issueIn('closed');
    const other = await seedProject(harness.ds, userId);
    const foreign = await issueIn('open', other.id);
    const missing = '00000000-0000-4000-8000-00000000dead';
    const ids = [foreign.uuid, closed.uuid, missing, open.uuid];

    const result = await bulk(ids, 'closed');

    expect(result).toEqual({ state: 'closed', changed: [open.uuid], unchanged: [closed.uuid], notFound: [foreign.uuid, missing] });
    expect((await stored(open.id)).state).toBe('closed');
    expect((await stored(foreign.id)).state).toBe('open');
  });

  it('keeps the request order within each list', async () => {
    const [a, b, c] = [await issueIn('open'), await issueIn('open'), await issueIn('open')];
    const result = await bulk([c.uuid, a.uuid, b.uuid], 'closed');

    expect(result.changed).toEqual([c.uuid, a.uuid, b.uuid]);
    expect(await Promise.all([a, b, c].map(async (issue) => (await stored(issue.id)).state))).toEqual(['closed', 'closed', 'closed']);
  });

  it('flips the state and updated_at with one clock instant, leaving title and body alone', async () => {
    const [a, b] = [await issueIn('open'), await issueIn('open')];

    await bulk([a.uuid, b.uuid], 'closed');

    for (const issue of [a, b]) {
      const row = await stored(issue.id);

      expect(row.state).toBe('closed');
      expect(row.updatedAt).toEqual(harness.clock.now());
      expect(row.createdAt).toEqual(SEED_TIME);
    }
  });

  it('E70: writes nothing and enqueues nothing when every id is unchanged or not found, but still answers 200', async () => {
    const closed = await issueIn('closed');
    await seedLink(harness.ds, { userId, issueId: closed.id });
    const upsert = jest.spyOn(harness.get(IssueMarkers), 'upsertForBulk');
    const update = jest.spyOn(harness.get(IssueStore), 'updateStateMany');

    const result = await bulk([closed.uuid, '00000000-0000-4000-8000-00000000dead'], 'closed');

    expect(result).toEqual({ state: 'closed', changed: [], unchanged: [closed.uuid], notFound: ['00000000-0000-4000-8000-00000000dead'] });
    expect((await stored(closed.id)).updatedAt).toEqual(SEED_TIME);
    expect(update).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(await markers()).toEqual([]);
    expect(trigger).not.toHaveBeenCalled();
  });

  it('E72: creates markers only for linked and sync_failed links, none for a gone link (still counted as changed), and runs one trigger after the commit', async () => {
    const [unlinked, linked, failed, gone] = [await issueIn('open'), await issueIn('open'), await issueIn('open'), await issueIn('open')];
    const linkedLink = await seedLink(harness.ds, { userId, issueId: linked.id });
    const failedLink = await seedLink(harness.ds, { userId, issueId: failed.id, status: 'sync_failed' });

    await seedLink(harness.ds, { userId, issueId: gone.id, status: 'gone', statusReason: 'deleted' });

    const result = await bulk([unlinked.uuid, linked.uuid, failed.uuid, gone.uuid], 'closed');
    const rows = await markers();

    expect(result.changed).toHaveLength(4);
    expect(rows.map((row) => [row.link_id, row.revision])).toEqual([[linkedLink.id, 1], [failedLink.id, 1]]);
    expect(rows[0].marked_at).toEqual(new Date(Math.floor(harness.clock.now().getTime() / 1000) * 1000));
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveBeenCalledWith([linkedLink.id, failedLink.id]);
  });

  it('bumps the revision of an existing marker and keeps its marked_at', async () => {
    const issue = await issueIn('open');
    const link = await seedLink(harness.ds, { userId, issueId: issue.id });

    await seedMarker(harness.ds, link.id, { revision: 4 });
    await bulk([issue.uuid], 'closed');

    const [row] = await markers();

    expect(row).toMatchObject({ link_id: link.id, revision: 5 });
    expect(row.marked_at).toEqual(SEED_TIME);
    expect(row.updated_at).toEqual(new Date(Math.floor(harness.clock.now().getTime() / 1000) * 1000));
  });

  it('E12: bumps no marker for an unchanged linked issue', async () => {
    const issue = await issueIn('closed');

    await seedLink(harness.ds, { userId, issueId: issue.id });
    await bulk([issue.uuid], 'closed');

    expect(await markers()).toEqual([]);
    expect(trigger).not.toHaveBeenCalled();
  });

  it('locks the issues in ascending internal id order whatever the request order', async () => {
    const [a, b, c] = [await issueIn('open'), await issueIn('open'), await issueIn('open')];
    const lock = jest.spyOn(harness.get(IssueStore), 'lockManyInProject');

    await bulk([c.uuid, a.uuid, b.uuid], 'closed');

    const locked = await lock.mock.results[0].value as Issue[];

    expect(locked.map((issue) => issue.id)).toEqual([a.id, b.id, c.id]);
  });

  it('rolls everything back and enqueues nothing when the marker upsert fails', async () => {
    const [a, b] = [await issueIn('open'), await issueIn('open')];

    await seedLink(harness.ds, { userId, issueId: b.id });
    jest.spyOn(harness.get(IssueMarkers), 'upsertForBulk').mockRejectedValueOnce(new Error('boom'));

    await expect(bulk([a.uuid, b.uuid], 'closed')).rejects.toThrow('boom');

    expect((await stored(a.id)).state).toBe('open');
    expect((await stored(b.id)).state).toBe('open');
    expect(await markers()).toEqual([]);
    expect(trigger).not.toHaveBeenCalled();
  });

  it('never fails the request when the trigger throws, and logs the link ids only', async () => {
    const issue = await issueIn('open');
    const link = await seedLink(harness.ds, { userId, issueId: issue.id });

    trigger.mockImplementationOnce(() => { throw new Error('queue down'); });

    const result = await bulk([issue.uuid], 'closed');

    expect(result.changed).toEqual([issue.uuid]);
    expect(harness.logger.error).toHaveBeenCalledWith('issues sync trigger failed', expect.objectContaining({ linkIds: [link.id] }));
    expect(await markers()).toHaveLength(1);
  });

  it.each([
    ['a missing project', () => ({ uuid: '00000000-0000-4000-8000-00000000dead' })],
    ['a deleted project', () => seedProject(harness.ds, userId, { deleted: true })],
    ['another user\'s project', async () => seedProject(harness.ds, await seedUser(harness.ds, 'stranger'))],
  ])('answers 404 for %s, after consuming the weight', async (_label, make) => {
    const target = await make();
    const consume = jest.spyOn(harness.get(IssueEditRateLimiter), 'consume');

    await expect(bulk(['00000000-0000-4000-8000-000000000001'], 'closed', target as SeededProject)).rejects.toBeInstanceOf(NotFoundException);
    expect(consume).toHaveBeenCalledWith(userId, 1);
  });

  it('answers 404 and applies nothing when the project is deleted after the access check (E67)', async () => {
    const issue = await issueIn('open');
    const access = harness.get(IssuesAccess);
    const original = access.findLiveProject.bind(access);
    let calls = 0;

    jest.spyOn(access, 'findLiveProject').mockImplementation(async (...args) => {
      calls += 1;

      if (calls === 2) {
        await harness.ds.query('UPDATE issues_projects SET deleted_at = ?, deleted_token = id WHERE id = ?', [SEED_TIME, project.id]);
      }

      return original(...args);
    });

    await expect(bulk([issue.uuid], 'closed')).rejects.toBeInstanceOf(NotFoundException);
    expect(calls).toBe(2);
    expect((await stored(issue.id)).state).toBe('open');
  });

  it('weights the rate limit by the id count', async () => {
    const consume = jest.spyOn(harness.get(IssueEditRateLimiter), 'consume');

    await bulk(['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003'], 'closed');

    expect(consume).toHaveBeenCalledWith(userId, 3);
  });

  it('E74: answers 429 before any database work when the limiter refuses', async () => {
    const issue = await issueIn('open');

    jest.spyOn(harness.get(IssueEditRateLimiter), 'consume').mockReturnValueOnce({ allowed: false, retryAfterMs: 2_500 });

    const access = jest.spyOn(harness.get(IssuesAccess), 'findLiveProject');
    const refused = await bulk([issue.uuid], 'closed').catch((error: unknown) => error);

    expect(refused).toBeInstanceOf(HttpException);
    expect((refused as HttpException).getStatus()).toBe(429);
    expect(((refused as HttpException).getResponse() as { retryAfterSeconds: number }).retryAfterSeconds).toBe(3);
    expect(access).not.toHaveBeenCalled();
    expect((await stored(issue.id)).state).toBe('open');
  });

  it('E70: still consumes the weight when every id is unchanged', async () => {
    const closed = await issueIn('closed');
    const consume = jest.spyOn(harness.get(IssueEditRateLimiter), 'consume');

    await bulk([closed.uuid], 'closed');

    expect(consume).toHaveBeenCalledWith(userId, 1);
  });

  it.each([
    ['a paused integration', () => harness.get(IssueRateLimitPauses).pause(INTEGRATION, new Date(harness.clock.now().getTime() + 600_000))],
    ['a missing credential', () => harness.github.setUsable(userId, [])],
    ['an Unavailable repository', () => harness.repositories.seed(userId, { repositoryId: 7001, githubId: 700, owner: 'darthjee', name: 'kerghan', status: 'unavailable', integrationSourceIds: [INTEGRATION] })],
  ])('E71: writes the marker and enqueues one T1 for a linked issue with %s, as a single Edit does', async (_label, arrange) => {
    const issue = await issueIn('open');
    const link = await seedLink(harness.ds, { userId, issueId: issue.id });

    harness.github.setUsable(userId, [integrationRef(INTEGRATION)]);
    arrange();

    expect((await bulk([issue.uuid], 'closed')).changed).toEqual([issue.uuid]);
    expect((await markers()).map((row) => row.link_id)).toEqual([link.id]);
    expect(harness.workers.paramsOf(ISSUES_RECONCILE_JOB)).toEqual([{ linkId: link.id }]);
  });

  it('E74: applies nothing and consumes nothing on a refusal, and a retry after Retry-After succeeds', async () => {
    const issue = await issueIn('open');
    const limiter = harness.get(IssueEditRateLimiter);

    expect(limiter.consume(userId, 120).allowed).toBe(true);

    const refused = await bulk([issue.uuid], 'closed').catch((error: unknown) => error as HttpException);
    const retryAfter = (refused as HttpException).getResponse() as { code: string; retryAfterSeconds: number };

    expect((refused as HttpException).getStatus()).toBe(429);
    expect(retryAfter.code).toBe(ErrorCodes.ISSUE_EDIT_RATE_LIMITED);
    expect((await stored(issue.id)).state).toBe('open');

    harness.clock.advance(retryAfter.retryAfterSeconds * 1000);

    expect(await bulk([issue.uuid], 'closed')).toMatchObject({ changed: [issue.uuid] });
  });
});
