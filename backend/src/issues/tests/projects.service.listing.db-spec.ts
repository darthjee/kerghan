import { NotFoundException } from '@nestjs/common';
import { seedUser } from '../../repositories/tests/support/two-user-baseline.js';
import { ProjectsService } from '../projects.service.js';
import { buildIssuesDbHarness, type IssuesDbHarness } from './support/issues-db-harness.js';
import { seedIssue, seedProject } from './support/issues-seeds.js';

const DEFAULTS = { page: 1, perPage: 50, search: '' };

describe('ProjectsService#list / #show (real MySQL)', () => {
  let harness: IssuesDbHarness;
  let service: ProjectsService;
  let userId: number;

  beforeAll(async () => {
    harness = await buildIssuesDbHarness();
    service = harness.get(ProjectsService);
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    userId = await seedUser(harness.ds, 'owner');
  });

  const names = async (input: Partial<typeof DEFAULTS>): Promise<string[]> => (
    (await service.list(userId, { ...DEFAULTS, ...input })).projects.map((project) => project.name)
  );

  describe('list', () => {
    it('answers an empty first page for a user without projects', async () => {
      expect(await service.list(userId, DEFAULTS)).toEqual({
        projects: [],
        pagination: { page: 1, perPage: 50, total: 0, totalPages: 0 },
      });
    });

    it('sorts by name, case-insensitively', async () => {
      for (const name of ['beta', 'Alpha', 'gamma', 'ALPHA 2']) await seedProject(harness.ds, userId, { name });

      expect(await names({})).toEqual(['Alpha', 'ALPHA 2', 'beta', 'gamma']);
    });

    it('lists live projects only, never a tombstone or another user\'s project', async () => {
      await seedProject(harness.ds, userId, { name: 'mine' });
      await seedProject(harness.ds, userId, { name: 'gone', deleted: true });

      expect(await names({})).toEqual(['mine']);
      expect((await service.list(userId, DEFAULTS)).pagination.total).toBe(1);
    });

    it('paginates, counting the matching rows, and answers an empty list past the end', async () => {
      for (const name of ['a', 'b', 'c', 'd', 'e']) await seedProject(harness.ds, userId, { name });

      expect(await service.list(userId, { page: 2, perPage: 2, search: '' })).toMatchObject({
        projects: [{ name: 'c' }, { name: 'd' }],
        pagination: { page: 2, perPage: 2, total: 5, totalPages: 3 },
      });
      expect(await service.list(userId, { page: 9, perPage: 2, search: '' })).toMatchObject({
        projects: [],
        pagination: { page: 9, perPage: 2, total: 5, totalPages: 3 },
      });
    });

    it('searches a case-insensitive literal substring of the name, counting only the matches', async () => {
      for (const name of ['Road Map', 'roadmap', 'other']) await seedProject(harness.ds, userId, { name });

      expect(await names({ search: 'ROAD' })).toEqual(['Road Map', 'roadmap']);
      expect(await names({ search: 'road m' })).toEqual(['Road Map']);
      expect((await service.list(userId, { ...DEFAULTS, search: 'road' })).pagination.total).toBe(2);
      expect(await names({ search: 'nothing' })).toEqual([]);
    });

    it.each([
      ['%', ['100% sure']],
      ['_', ['snake_case']],
      ['\\', ['back\\slash']],
      ['a_b', []],
      ['%%', []],
    ])('treats %s in the search as a literal', async (search, expected) => {
      for (const name of ['100% sure', 'snake_case', 'back\\slash', 'plain name', 'axb']) {
        await seedProject(harness.ds, userId, { name });
      }

      expect(await names({ search })).toEqual(expected);
    });

    it('reads every repository summary and count of a page in one call each, with 0 and a dangling reference', async () => {
      harness.repositories.seed(userId, { repositoryId: 701, githubId: 71, owner: 'o', name: 'one' });
      const busy = await seedProject(harness.ds, userId, { name: 'busy', repositoryId: 701 });
      await seedProject(harness.ds, userId, { name: 'dangling', repositoryId: 799 });
      await seedProject(harness.ds, userId, { name: 'plain' });
      await seedIssue(harness.ds, busy.id, { state: 'open' });
      await seedIssue(harness.ds, busy.id, { state: 'closed' });
      const before = harness.repositories.callsOf('projectSummaries');

      const { projects } = await service.list(userId, DEFAULTS);

      expect(harness.repositories.callsOf('projectSummaries')).toBe(before + 1);
      expect(projects.map((project) => [project.name, project.openIssueCount, project.repository?.fullName ?? null])).toEqual([
        ['busy', 1, 'o/one'],
        ['dangling', 0, null],
        ['plain', 0, null],
      ]);
      expect(projects[1].repository).toEqual({
        githubId: null, owner: null, name: null, fullName: null, private: null, status: 'unavailable',
      });
      expect(projects[2].repository).toBeNull();
    });

    it('never leaks an internal id or the owner', async () => {
      await seedProject(harness.ds, userId, { name: 'mine' });

      const [project] = (await service.list(userId, DEFAULTS)).projects;

      expect(Object.keys(project).sort()).toEqual(['createdAt', 'description', 'id', 'name', 'openIssueCount', 'repository', 'updatedAt']);
    });
  });

  describe('show', () => {
    it('answers the project with its summary and count', async () => {
      harness.repositories.seed(userId, { repositoryId: 702, githubId: 72, owner: 'o', name: 'two' });
      const project = await seedProject(harness.ds, userId, { name: 'shown', description: 'd', repositoryId: 702 });
      await seedIssue(harness.ds, project.id);

      expect(await service.show(userId, project.uuid)).toMatchObject({
        id: project.uuid,
        name: 'shown',
        description: 'd',
        openIssueCount: 1,
        repository: { githubId: 72, fullName: 'o/two' },
      });
    });

    it('answers a non-code project with a null repository', async () => {
      const project = await seedProject(harness.ds, userId);

      expect((await service.show(userId, project.uuid)).repository).toBeNull();
    });

    it('answers the same 404 for a missing, a foreign and a deleted project', async () => {
      const { intruder } = harness;
      const deleted = await seedProject(harness.ds, userId, { deleted: true });
      const bodies: unknown[] = [];

      for (const uuid of ['00000000-0000-4000-8000-000000000000', intruder.projectUuid, deleted.uuid]) {
        const error = await service.show(userId, uuid).then(() => null, (e: unknown) => e);

        expect(error).toBeInstanceOf(NotFoundException);
        bodies.push((error as NotFoundException).getResponse());
      }

      expect(new Set(bodies.map((body) => JSON.stringify(body))).size).toBe(1);
    });
  });
});
