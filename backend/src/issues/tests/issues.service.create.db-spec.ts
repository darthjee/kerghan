import { NotFoundException } from '@nestjs/common';
import { seedUser } from '../../repositories/tests/support/two-user-baseline.js';
import { Issue } from '../entities/issue.entity.js';
import { IssueSyncTrigger } from '../issue-sync-trigger.js';
import { IssuesService } from '../issues.service.js';
import { buildIssuesDbHarness, HARNESS_START, type IssuesDbHarness } from './support/issues-db-harness.js';
import { seedIntruder, seedIssue, seedProject, type SeededProject } from './support/issues-seeds.js';

const CAP = 3;

describe('IssuesService#create (real MySQL)', () => {
  let harness: IssuesDbHarness;
  let service: IssuesService;
  let userId: number;
  let project: SeededProject;
  let trigger: jest.SpyInstance;

  beforeAll(async () => {
    harness = await buildIssuesDbHarness({ KERGHAN_ISSUES_MAX_ISSUES_PER_PROJECT: `${CAP}` });
    service = harness.get(IssuesService);
    trigger = jest.spyOn(harness.get(IssueSyncTrigger), 'afterCommit');
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    trigger.mockClear();
    userId = await seedUser(harness.ds, 'owner');
    project = await seedProject(harness.ds, userId);
    harness.clock.set(new Date(HARNESS_START.getTime() + 789));
  });

  const stored = (): Promise<Issue[]> => harness.ds.getRepository(Issue).find({ where: { projectId: project.id } });
  const create = (input: { title: string; body?: string | null; state?: 'open' | 'closed' }) => service.create(
    userId,
    project.uuid,
    { body: null, state: 'open', ...input },
  );

  it('creates an open, unlinked issue with a null link and the clock\'s timestamps', async () => {
    const created = await create({ title: 'Fix it' });
    const [row] = await stored();

    expect(created).toEqual({
      id: row.uuid,
      title: 'Fix it',
      body: null,
      state: 'open',
      createdAt: '2026-06-01T12:00:00.000Z',
      updatedAt: '2026-06-01T12:00:00.789Z',
      link: null,
    });
    expect(row).toMatchObject({ title: 'Fix it', body: null, state: 'open', projectId: project.id });
    expect(row.updatedAt.getMilliseconds()).toBe(789);
    expect(trigger).not.toHaveBeenCalled();
  });

  it('stores the given state and a body as it is, whitespace kept', async () => {
    await create({ title: 'a', body: '  keep  ', state: 'closed' });

    expect(await stored()).toMatchObject([{ body: '  keep  ', state: 'closed' }]);
  });

  it('stores a 4-byte title and body intact (E54)', async () => {
    const title = '😀'.repeat(256);
    const body = `${'🚀'.repeat(1000)} text`;

    await create({ title, body });
    const [row] = await stored();

    expect(row.title).toBe(title);
    expect(row.body).toBe(body);
  });

  it('gives every issue its own uuid', async () => {
    const first = await create({ title: 'a' });
    const second = await create({ title: 'b' });

    expect(first.id).not.toBe(second.id);
  });

  it('refuses with ISSUES_LIMIT_REACHED at the cap, writing nothing', async () => {
    for (let index = 0; index < CAP; index += 1) await create({ title: `i${index}` });

    await expect(create({ title: 'over' })).rejects.toMatchObject({
      response: { code: 'ISSUES_LIMIT_REACHED', message: 'This project reached the maximum number of issues' },
    });
    expect(await stored()).toHaveLength(CAP);
  });

  it('counts the cap per project, not per user', async () => {
    const other = await seedProject(harness.ds, userId, { name: 'other' });
    for (let index = 0; index < CAP; index += 1) await seedIssue(harness.ds, other.id);

    await create({ title: 'still fits here' });

    expect(await stored()).toHaveLength(1);
  });

  it('answers 404 for another user\'s project and leaves the intruder untouched', async () => {
    const intruder = await seedIntruder(harness.ds);

    await expect(service.create(userId, intruder.projectUuid, { title: 'x', body: null, state: 'open' })).rejects.toBeInstanceOf(NotFoundException);
    expect(await harness.ds.getRepository(Issue).countBy({ projectId: intruder.projectId })).toBe(1);
  });
});
