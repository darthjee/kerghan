import { ProjectOpenIssueCounts } from '../open-issue-count.query.js';
import { buildIssuesDbHarness, type IssuesDbHarness } from './support/issues-db-harness.js';
import { seedIssue, seedLink, seedProject } from './support/issues-seeds.js';
import { seedUser } from '../../repositories/tests/support/two-user-baseline.js';

describe('ProjectOpenIssueCounts (real MySQL)', () => {
  let harness: IssuesDbHarness;
  let counts: ProjectOpenIssueCounts;
  let userId: number;

  beforeAll(async () => {
    harness = await buildIssuesDbHarness();
    counts = harness.get(ProjectOpenIssueCounts);
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    userId = await seedUser(harness.ds, 'owner');
  });

  describe('forProject', () => {
    it('is 0 for a project without issues or without open issues', async () => {
      const empty = await seedProject(harness.ds, userId);
      const closedOnly = await seedProject(harness.ds, userId);

      await seedIssue(harness.ds, closedOnly.id, { state: 'closed' });

      expect(await counts.forProject(empty.id)).toBe(0);
      expect(await counts.forProject(closedOnly.id)).toBe(0);
    });

    it('counts the open issues only, and only of that project', async () => {
      const project = await seedProject(harness.ds, userId);
      const other = await seedProject(harness.ds, userId);

      await seedIssue(harness.ds, project.id, { state: 'open' });
      await seedIssue(harness.ds, project.id, { state: 'open' });
      await seedIssue(harness.ds, project.id, { state: 'closed' });
      await seedIssue(harness.ds, other.id, { state: 'open' });

      expect(await counts.forProject(project.id)).toBe(2);
    });

    it('counts a linked issue by its local state', async () => {
      const project = await seedProject(harness.ds, userId);
      const open = await seedIssue(harness.ds, project.id, { state: 'open' });
      const closed = await seedIssue(harness.ds, project.id, { state: 'closed' });

      await seedLink(harness.ds, { userId, issueId: open.id });
      await seedLink(harness.ds, { userId, issueId: closed.id });

      expect(await counts.forProject(project.id)).toBe(1);
    });

    it('reads through a transaction manager', async () => {
      const project = await seedProject(harness.ds, userId);

      await seedIssue(harness.ds, project.id);

      await harness.ds.transaction(async (manager) => {
        expect(await counts.forProject(project.id, manager)).toBe(1);
      });
    });
  });

  describe('forPage', () => {
    it('runs no query for an empty page', async () => {
      const spy = jest.spyOn(harness.ds, 'query');

      expect((await counts.forPage([])).size).toBe(0);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('answers 0 for projects absent from the result and counts the others', async () => {
      const busy = await seedProject(harness.ds, userId);
      const closedOnly = await seedProject(harness.ds, userId);
      const empty = await seedProject(harness.ds, userId);

      await seedIssue(harness.ds, busy.id);
      await seedIssue(harness.ds, busy.id);
      await seedIssue(harness.ds, closedOnly.id, { state: 'closed' });

      const result = await counts.forPage([busy.id, closedOnly.id, empty.id]);

      expect([...result.entries()].sort(([a], [b]) => a - b)).toEqual(
        [[busy.id, 2], [closedOnly.id, 0], [empty.id, 0]].sort(([a], [b]) => a - b),
      );
    });

    it('makes one grouped query whatever the page size', async () => {
      const projects = [
        await seedProject(harness.ds, userId),
        await seedProject(harness.ds, userId),
        await seedProject(harness.ds, userId),
      ];
      const queries: string[] = [];
      const logger = harness.ds.logger;
      const spy = jest.spyOn(logger, 'logQuery').mockImplementation((query: string) => { queries.push(query); });

      await counts.forPage(projects.slice(0, 1).map((project) => project.id));
      const forOne = queries.length;
      await counts.forPage(projects.map((project) => project.id));

      expect(forOne).toBe(1);
      expect(queries.length - forOne).toBe(1);
      expect(queries[1]).toMatch(/GROUP BY/i);
      spy.mockRestore();
    });
  });
});
