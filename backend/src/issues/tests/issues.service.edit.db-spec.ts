import { NotFoundException } from '@nestjs/common';
import { seedUser } from '../../repositories/tests/support/two-user-baseline.js';
import { Issue } from '../entities/issue.entity.js';
import { IssueMarkers } from '../issue-markers.js';
import { IssueSyncTrigger } from '../issue-sync-trigger.js';
import { IssuesService } from '../issues.service.js';
import { buildIssuesDbHarness, HARNESS_START, type IssuesDbHarness } from './support/issues-db-harness.js';
import { seedIntruder, seedIssue, seedLink, seedProject, SEED_TIME, type SeededIssue, type SeededProject } from './support/issues-seeds.js';

interface MarkerRow {
  link_id: number;
  revision: number;
  marked_at: Date;
  updated_at: Date;
}

describe('IssuesService#edit (real MySQL)', () => {
  let harness: IssuesDbHarness;
  let service: IssuesService;
  let userId: number;
  let project: SeededProject;
  let issue: SeededIssue;
  let trigger: jest.SpyInstance;
  let run = 0;

  beforeAll(async () => {
    harness = await buildIssuesDbHarness();
    service = harness.get(IssuesService);
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    jest.restoreAllMocks();
    trigger = jest.spyOn(harness.get(IssueSyncTrigger), 'afterCommit');
    userId = await seedUser(harness.ds, 'owner');
    project = await seedProject(harness.ds, userId);
    issue = await seedIssue(harness.ds, project.id, { title: 'old', body: 'old body', state: 'open' });
    // A fresh edit-limiter window per test (the user id repeats after each truncate).
    run += 1;
    harness.clock.set(new Date(HARNESS_START.getTime() + run * 3_600_000 + 123));
  });

  const stored = (): Promise<Issue> => harness.ds.getRepository(Issue).findOneByOrFail({ id: issue.id });
  const markers = (): Promise<MarkerRow[]> => harness.ds.query('SELECT link_id, revision, marked_at, updated_at FROM issues_pending_writes');
  const edit = (input: Parameters<IssuesService['edit']>[3]) => service.edit(userId, project.uuid, issue.uuid, input);

  it('changes only the given fields and bumps updated_at with milliseconds', async () => {
    const result = await edit({ title: 'new' });
    const row = await stored();

    expect(result).toMatchObject({ title: 'new', body: 'old body', state: 'open', link: null });
    expect(result.updatedAt).toBe(harness.clock.now().toISOString());
    expect(row).toMatchObject({ title: 'new', body: 'old body', state: 'open' });
    expect(row.updatedAt.getMilliseconds()).toBe(123);
    expect(row.createdAt).toEqual(SEED_TIME);
  });

  it.each([
    ['body null', { body: null }],
    ['body empty', { body: '' }],
  ])('clears the body with %s', async (_label, input) => {
    expect((await edit(input)).body).toBeNull();
    expect((await stored()).body).toBeNull();
  });

  it('keeps a whitespace-only body and edits the state alone', async () => {
    await edit({ body: '   ' });
    await edit({ state: 'closed' });

    expect(await stored()).toMatchObject({ body: '   ', state: 'closed', title: 'old' });
  });

  it.each([
    ['an empty body', {}],
    ['values equal to the stored ones', { title: 'old', body: 'old body', state: 'open' as const }],
  ])('writes nothing for %s: no update, no marker, no trigger (E12)', async (_label, input) => {
    await seedLink(harness.ds, { userId, issueId: issue.id });
    const upsert = jest.spyOn(harness.get(IssueMarkers), 'upsertForEdit');

    const result = await edit(input);

    expect(result.updatedAt).toBe(SEED_TIME.toISOString());
    expect((await stored()).updatedAt).toEqual(SEED_TIME);
    expect(await markers()).toEqual([]);
    expect(upsert).not.toHaveBeenCalled();
    expect(trigger).not.toHaveBeenCalled();
  });

  it('treats an empty body string on an already null body as no change', async () => {
    await harness.ds.query('UPDATE issues SET body = NULL WHERE id = ?', [issue.id]);

    const result = await edit({ body: '' });

    expect(result.updatedAt).toBe(SEED_TIME.toISOString());
    expect((await stored()).updatedAt).toEqual(SEED_TIME);
  });

  it('bumps no marker and calls no trigger for an unlinked issue', async () => {
    await edit({ title: 'new' });

    expect(await markers()).toEqual([]);
    expect(trigger).not.toHaveBeenCalled();
  });

  it.each(['linked', 'sync_failed'])('creates the marker for a %s link, then bumps it on a second edit', async (status) => {
    const link = await seedLink(harness.ds, { userId, issueId: issue.id, status });

    await edit({ title: 'one' });
    const [first] = await markers();

    expect(first).toMatchObject({ link_id: link.id, revision: 1 });
    expect(first.marked_at).toEqual(new Date(Math.floor(harness.clock.now().getTime() / 1000) * 1000));
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveBeenLastCalledWith([link.id]);

    harness.clock.advance(10_000);
    await edit({ title: 'two' });
    const [second] = await markers();

    expect(second.revision).toBe(2);
    expect(second.marked_at).toEqual(first.marked_at);
    expect(second.updated_at.getTime()).toBe(first.updated_at.getTime() + 10_000);
    expect(trigger).toHaveBeenCalledTimes(2);
  });

  it('bumps no marker and calls no trigger for a gone link (local edits only)', async () => {
    await seedLink(harness.ds, { userId, issueId: issue.id, status: 'gone', statusReason: 'deleted' });

    await edit({ title: 'new' });

    expect((await stored()).title).toBe('new');
    expect(await markers()).toEqual([]);
    expect(trigger).not.toHaveBeenCalled();
  });

  it('rolls the issue update back and calls no trigger when the marker upsert fails (E52)', async () => {
    await seedLink(harness.ds, { userId, issueId: issue.id });
    jest.spyOn(harness.get(IssueMarkers), 'upsertForEdit').mockRejectedValueOnce(new Error('boom'));

    await expect(edit({ title: 'lost' })).rejects.toThrow('boom');

    expect(await stored()).toMatchObject({ title: 'old', updatedAt: SEED_TIME });
    expect(await markers()).toEqual([]);
    expect(trigger).not.toHaveBeenCalled();
  });

  it('answers 200 with the edit committed when the trigger throws, logging link ids only', async () => {
    const link = await seedLink(harness.ds, { userId, issueId: issue.id });
    trigger.mockImplementation(() => {
      throw new Error('queue down: secret title');
    });

    const result = await edit({ title: 'new' });

    expect(result.title).toBe('new');
    expect((await stored()).title).toBe('new');
    expect(await markers()).toHaveLength(1);
    expect(harness.logger.error).toHaveBeenCalledWith('issues sync trigger failed', expect.objectContaining({ linkIds: [link.id] }));
    expect(JSON.stringify(harness.logger.error.mock.calls)).not.toContain('secret title');
  });

  it('answers 404 for the intruder\'s rows and leaves them untouched', async () => {
    const intruder = await seedIntruder(harness.ds);

    await expect(service.edit(userId, intruder.projectUuid, intruder.issueUuid, { title: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.edit(userId, project.uuid, intruder.issueUuid, { title: 'x' })).rejects.toBeInstanceOf(NotFoundException);

    const row = await harness.ds.getRepository(Issue).findOneByOrFail({ id: intruder.issueId });

    expect(row.title).toBe('intruder issue');
    expect(await markers()).toHaveLength(1);
    expect(trigger).not.toHaveBeenCalled();
  });
});
