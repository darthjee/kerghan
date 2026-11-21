import { NotFoundException } from '@nestjs/common';
import { seedUser } from '../../repositories/tests/support/two-user-baseline.js';
import { IssuesService } from '../issues.service.js';
import { buildIssuesDbHarness, type IssuesDbHarness } from './support/issues-db-harness.js';
import { seedIntruder, seedIssue, seedProject, type SeededProject } from './support/issues-seeds.js';

const DEFAULTS = { page: 1, perPage: 50, state: 'open' as const, search: '' };

describe('IssuesService#list / #show (real MySQL)', () => {
  let harness: IssuesDbHarness;
  let service: IssuesService;
  let userId: number;
  let project: SeededProject;

  beforeAll(async () => {
    harness = await buildIssuesDbHarness();
    service = harness.get(IssuesService);
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    userId = await seedUser(harness.ds, 'owner');
    project = await seedProject(harness.ds, userId);
  });

  const list = (input: Partial<typeof DEFAULTS> = {}, uuid = project.uuid) => service.list(userId, uuid, { ...DEFAULTS, ...input });
  const titles = async (input: Partial<typeof DEFAULTS> = {}): Promise<string[]> => (await list(input)).issues.map((issue) => issue.title);
  const createdAt = (id: number, at: string): Promise<unknown> => harness.ds.query('UPDATE issues SET created_at = ? WHERE id = ?', [new Date(at), id]);

  it('answers an empty first page for a project without issues', async () => {
    expect(await list()).toEqual({ issues: [], pagination: { page: 1, perPage: 50, total: 0, totalPages: 0 } });
  });

  it('filters by state: open by default, then closed, then all', async () => {
    await seedIssue(harness.ds, project.id, { title: 'o', state: 'open' });
    await seedIssue(harness.ds, project.id, { title: 'c', state: 'closed' });

    expect(await titles()).toEqual(['o']);
    expect(await titles({ state: 'closed' })).toEqual(['c']);
    expect((await titles({ state: 'all' })).sort()).toEqual(['c', 'o']);
    expect((await list({ state: 'all' })).pagination.total).toBe(2);
  });

  it('sorts by created_at descending, then by id descending for equal created_at', async () => {
    await seedIssue(harness.ds, project.id, { title: 'first' });
    await seedIssue(harness.ds, project.id, { title: 'second' });
    await seedIssue(harness.ds, project.id, { title: 'third' });
    const oldest = await seedIssue(harness.ds, project.id, { title: 'oldest' });

    await createdAt(oldest.id, '2026-01-01T00:00:00Z');
    expect(await titles()).toEqual(['third', 'second', 'first', 'oldest']);
  });

  it('does not reorder after an edit', async () => {
    const older = await seedIssue(harness.ds, project.id, { title: 'older' });
    await seedIssue(harness.ds, project.id, { title: 'newer' });
    await createdAt(older.id, '2026-01-01T00:00:00Z');

    await service.edit(userId, project.uuid, older.uuid, { title: 'older edited' });

    expect(await titles()).toEqual(['newer', 'older edited']);
  });

  it('paginates and reports totals; a page past the end is empty', async () => {
    for (let index = 1; index <= 5; index += 1) await seedIssue(harness.ds, project.id, { title: `issue ${index}` });

    expect(await list({ perPage: 2, page: 2 })).toMatchObject({
      issues: [{ title: 'issue 3' }, { title: 'issue 2' }],
      pagination: { page: 2, perPage: 2, total: 5, totalPages: 3 },
    });
    expect(await list({ perPage: 2, page: 4 })).toEqual({
      issues: [],
      pagination: { page: 4, perPage: 2, total: 5, totalPages: 3 },
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      for (const title of ['100% sure', 'a_b', 'a-b', 'back\\slash', 'Plain Title']) {
        await seedIssue(harness.ds, project.id, { title });
      }
      await seedIssue(harness.ds, project.id, { title: 'other', body: 'plain body only' });
    });

    it.each([
      ['%', ['100% sure']],
      ['_', ['a_b']],
      ['\\', ['back\\slash']],
      ['a_b', ['a_b']],
      ['PLAIN', ['Plain Title']],
    ])('matches %j as a literal, case-insensitive substring of the title', async (search, expected) => {
      expect(await titles({ search })).toEqual(expected);
    });

    it('searches the title only, never the body', async () => {
      expect(await titles({ search: 'body only' })).toEqual([]);
    });
  });

  it('leaves the body out of every row', async () => {
    await seedIssue(harness.ds, project.id, { title: 'with body', body: 'secret text' });

    const [row] = (await list()).issues;

    expect(row).not.toHaveProperty('body');
    expect(JSON.stringify(row)).not.toContain('secret text');
    expect(row.link).toBeNull();
  });

  it('is scoped to the project: another project and the intruder never appear', async () => {
    const intruder = await seedIntruder(harness.ds);
    const other = await seedProject(harness.ds, userId, { name: 'other' });
    await seedIssue(harness.ds, other.id, { title: 'in other project' });
    await seedIssue(harness.ds, project.id, { title: 'mine' });

    expect(await titles({ state: 'all' })).toEqual(['mine']);
    await expect(list({}, intruder.projectUuid)).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('show', () => {
    it('returns the issue with its body and a null link', async () => {
      const issue = await seedIssue(harness.ds, project.id, { title: 'T', body: 'B' });

      expect(await service.show(userId, project.uuid, issue.uuid)).toEqual({
        id: issue.uuid,
        title: 'T',
        body: 'B',
        state: 'open',
        createdAt: '2026-06-01T12:00:00.000Z',
        updatedAt: '2026-06-01T12:00:00.000Z',
        link: null,
      });
    });

    it('answers 404 for a missing issue, another project\'s issue and the intruder\'s project', async () => {
      const intruder = await seedIntruder(harness.ds);
      const other = await seedProject(harness.ds, userId, { name: 'other' });
      const foreign = await seedIssue(harness.ds, other.id);

      await expect(service.show(userId, project.uuid, foreign.uuid)).rejects.toMatchObject({ response: { message: 'Issue not found' } });
      await expect(service.show(userId, project.uuid, intruder.issueUuid)).rejects.toMatchObject({ response: { message: 'Issue not found' } });
      await expect(service.show(userId, intruder.projectUuid, intruder.issueUuid)).rejects.toMatchObject({ response: { message: 'Project not found' } });
    });
  });
});
