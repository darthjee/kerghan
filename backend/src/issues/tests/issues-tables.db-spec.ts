import { Issue } from '../entities/issue.entity.js';
import { IssuesProject } from '../entities/issues-project.entity.js';
import { buildIssuesDbHarness, type IssuesDbHarness } from './support/issues-db-harness.js';
import { seedIntruder, seedIssue, seedLink, seedMarker, seedProject, SEED_TIME } from './support/issues-seeds.js';
import { seedUser } from '../../repositories/tests/support/two-user-baseline.js';

const DUPLICATE = { code: 'ER_DUP_ENTRY' };

describe('Issues tables (real MySQL)', () => {
  let harness: IssuesDbHarness;

  beforeAll(async () => {
    harness = await buildIssuesDbHarness();
  });

  afterAll(() => harness.close());

  async function setup(): Promise<{ userId: number; intruderId: number }> {
    const userId = await seedUser(harness.ds, 'owner');
    const intruder = await seedIntruder(harness.ds);

    return { userId, intruderId: intruder.userId };
  }

  describe('project uniqueness among live projects', () => {
    it('rejects a live duplicate name, and accepts it once the first project is soft-deleted', async () => {
      const { userId, intruderId } = await setup();
      const first = await seedProject(harness.ds, userId, { name: 'Alpha' });

      await expect(seedProject(harness.ds, userId, { name: 'Alpha' })).rejects.toMatchObject(DUPLICATE);
      await expect(seedProject(harness.ds, intruderId, { name: 'Alpha' })).resolves.toBeDefined();

      await harness.ds.query('UPDATE issues_projects SET deleted_at = ?, deleted_token = id WHERE id = ?', [SEED_TIME, first.id]);

      await expect(seedProject(harness.ds, userId, { name: 'Alpha' })).resolves.toBeDefined();
    });

    it('rejects a live duplicate repository, and accepts it once the first project is soft-deleted', async () => {
      const { userId } = await setup();
      const first = await seedProject(harness.ds, userId, { repositoryId: 42 });

      await expect(seedProject(harness.ds, userId, { repositoryId: 42 })).rejects.toMatchObject(DUPLICATE);

      await harness.ds.query('UPDATE issues_projects SET deleted_at = ?, deleted_token = id WHERE id = ?', [SEED_TIME, first.id]);

      await expect(seedProject(harness.ds, userId, { repositoryId: 42 })).resolves.toBeDefined();
    });

    it('never collides on a NULL repository', async () => {
      const { userId } = await setup();

      await seedProject(harness.ds, userId, { repositoryId: null });
      await expect(seedProject(harness.ds, userId, { repositoryId: null })).resolves.toBeDefined();
    });

    it('treats names that differ only by case or accents as duplicates', async () => {
      const { userId } = await setup();

      await seedProject(harness.ds, userId, { name: 'Café' });
      await expect(seedProject(harness.ds, userId, { name: 'CAFÉ' })).rejects.toMatchObject(DUPLICATE);
      await expect(seedProject(harness.ds, userId, { name: 'cafe' })).rejects.toMatchObject(DUPLICATE);
    });

    it('seeds deleted_at and deleted_token together, the token being the id and never 0 (E50)', async () => {
      const { userId } = await setup();
      const live = await seedProject(harness.ds, userId);
      const deleted = await seedProject(harness.ds, userId, { deleted: true });
      const rows = await harness.ds.getRepository(IssuesProject).find({ where: [{ id: live.id }, { id: deleted.id }], order: { id: 'ASC' } });

      expect(rows[0]).toMatchObject({ deletedAt: null, deletedToken: 0 });
      expect(rows[1].deletedAt).toEqual(SEED_TIME);
      expect(rows[1].deletedToken).toBe(deleted.id);
      expect(rows[1].deletedToken).not.toBe(0);
    });
  });

  describe('uuid unique indexes', () => {
    it('rejects a second project with the same uuid', async () => {
      const { userId } = await setup();
      const project = await seedProject(harness.ds, userId);
      const repository = harness.ds.getRepository(IssuesProject);

      await expect(repository.save(repository.create({
        uuid: project.uuid, userId, name: 'other', description: null, repositoryId: null,
        deletedAt: null, deletedToken: 0, createdAt: SEED_TIME, updatedAt: SEED_TIME,
      }))).rejects.toMatchObject(DUPLICATE);
    });

    it('rejects a second issue with the same uuid', async () => {
      const { userId } = await setup();
      const project = await seedProject(harness.ds, userId);
      const issue = await seedIssue(harness.ds, project.id);
      const repository = harness.ds.getRepository(Issue);

      await expect(repository.save(repository.create({
        uuid: issue.uuid, projectId: project.id, title: 'dup', body: null, state: 'open', createdAt: SEED_TIME, updatedAt: SEED_TIME,
      }))).rejects.toMatchObject(DUPLICATE);
    });
  });

  describe('links and markers', () => {
    it('keeps one link per (user, GitHub issue), but lets two users link the same id (E45)', async () => {
      const { userId, intruderId } = await setup();
      const project = await seedProject(harness.ds, userId);
      const first = await seedIssue(harness.ds, project.id);
      const second = await seedIssue(harness.ds, project.id);
      const intruderProject = await seedProject(harness.ds, intruderId);
      const intruderIssue = await seedIssue(harness.ds, intruderProject.id);
      const githubIssueId = 2 ** 31 + 77;

      await seedLink(harness.ds, { userId, issueId: first.id, githubIssueId });
      await expect(seedLink(harness.ds, { userId, issueId: second.id, githubIssueId })).rejects.toMatchObject(DUPLICATE);
      await expect(seedLink(harness.ds, { userId: intruderId, issueId: intruderIssue.id, githubIssueId })).resolves.toBeDefined();
    });

    it('keeps at most one link per issue', async () => {
      const { userId } = await setup();
      const project = await seedProject(harness.ds, userId);
      const issue = await seedIssue(harness.ds, project.id);

      await seedLink(harness.ds, { userId, issueId: issue.id });
      await expect(seedLink(harness.ds, { userId, issueId: issue.id })).rejects.toMatchObject(DUPLICATE);
    });

    it('keeps one marker per link', async () => {
      const { userId } = await setup();
      const project = await seedProject(harness.ds, userId);
      const issue = await seedIssue(harness.ds, project.id);
      const link = await seedLink(harness.ds, { userId, issueId: issue.id });

      await seedMarker(harness.ds, link.id);
      await expect(seedMarker(harness.ds, link.id)).rejects.toMatchObject(DUPLICATE);
    });

    it('stores a NULL status_reason for linked and deleted or moved for gone', async () => {
      const { userId } = await setup();
      const project = await seedProject(harness.ds, userId);
      const linked = await seedLink(harness.ds, { userId, issueId: (await seedIssue(harness.ds, project.id)).id });
      const deleted = await seedLink(harness.ds, {
        userId, issueId: (await seedIssue(harness.ds, project.id)).id, status: 'gone', statusReason: 'deleted',
      });
      const moved = await seedLink(harness.ds, {
        userId, issueId: (await seedIssue(harness.ds, project.id)).id, status: 'gone', statusReason: 'moved',
      });
      const rows: Array<{ id: number; status: string; status_reason: string | null }> = await harness.ds.query(
        'SELECT id, status, status_reason FROM issues_github_links WHERE id IN (?, ?, ?) ORDER BY id', [linked.id, deleted.id, moved.id],
      );

      expect(rows.map((row) => [row.status, row.status_reason])).toEqual([
        ['linked', null], ['gone', 'deleted'], ['gone', 'moved'],
      ]);
    });
  });

  describe('round-trips', () => {
    it('stores a 4-byte character in a title and a body intact (E54)', async () => {
      const { userId } = await setup();
      const project = await seedProject(harness.ds, userId, { name: 'Emoji 🚀', description: 'desc 🚀' });
      const issue = await seedIssue(harness.ds, project.id, { title: 'Crash 🚀 on boot', body: 'Steps 🚀🚀 and more' });
      const read = await harness.ds.getRepository(Issue).findOneByOrFail({ id: issue.id });

      expect(read.title).toBe('Crash 🚀 on boot');
      expect(read.body).toBe('Steps 🚀🚀 and more');
      expect((await harness.ds.getRepository(IssuesProject).findOneByOrFail({ id: project.id })).name).toBe('Emoji 🚀');
    });

    it('stores a github_issue_id above 2^31 and reads it back as a number (E56)', async () => {
      const { userId } = await setup();
      const project = await seedProject(harness.ds, userId);
      const issue = await seedIssue(harness.ds, project.id);
      const big = 2 ** 31 + 123_456_789;
      const link = await seedLink(harness.ds, { userId, issueId: issue.id, githubIssueId: big });
      const read = await harness.ds.getRepository('IssueGithubLink').findOneByOrFail({ id: link.id }) as { githubIssueId: number };

      expect(read.githubIssueId).toBe(big);
      expect(typeof read.githubIssueId).toBe('number');
    });

    it('stores issues.updated_at with millisecond precision', async () => {
      const { userId } = await setup();
      const project = await seedProject(harness.ds, userId);
      const issue = await seedIssue(harness.ds, project.id);
      const instant = new Date('2026-06-01T12:00:00.123Z');

      await harness.ds.getRepository(Issue).update({ id: issue.id }, { updatedAt: instant });

      const read = await harness.ds.getRepository(Issue).findOneByOrFail({ id: issue.id });

      expect(read.updatedAt.getTime()).toBe(instant.getTime());
    });
  });
});
