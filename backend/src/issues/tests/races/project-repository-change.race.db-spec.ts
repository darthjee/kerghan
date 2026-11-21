import { seedUser } from '../../../repositories/tests/support/two-user-baseline.js';
import { IssuesProject } from '../../entities/issues-project.entity.js';
import { ProjectsService } from '../../projects.service.js';
import { buildIssuesDbHarness, type IssuesDbHarness } from '../support/issues-db-harness.js';
import { seedIssue, seedLink, seedProject } from '../support/issues-seeds.js';

// The change side of E62 (`github-link.md#same-repository-rule-and-repository-changes`): a
// repository change takes the project row lock first, so while another transaction holds it the
// change waits, and a link committed meanwhile makes it answer PROJECT_HAS_LINKS. The full race
// against the real link creation belongs to the link routes (#557).

describe('Repository change versus the project lock (real MySQL)', () => {
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
    harness.repositories.seed(userId, { repositoryId: 951, githubId: 95, owner: 'o', name: 'a' });
    harness.repositories.seed(userId, { repositoryId: 952, githubId: 96, owner: 'o', name: 'b' });
  });

  /** Waits (on timers, real MySQL I/O sits in between) until `condition` holds. */
  async function until(condition: () => boolean | Promise<boolean>, what: string): Promise<void> {
    for (let turn = 0; turn < 2_000; turn += 1) {
      if (await condition()) return;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error(`until: ${what} never held`);
  }

  /** Whether a statement of the change is blocked on a row lock. */
  const changeIsWaiting = async (): Promise<boolean> => {
    const rows: unknown[] = await harness.ds.query(
      "SELECT 1 FROM information_schema.processlist WHERE info LIKE '%issues_projects%FOR UPDATE%' AND info NOT LIKE '%processlist%'",
    );

    return rows.length > 0;
  };

  it.each(['change', 'detach'])('a %s waits for the project lock, then refuses with PROJECT_HAS_LINKS once a link committed', async (kind) => {
    const project = await seedProject(harness.ds, userId, { repositoryId: 951 });
    const issue = await seedIssue(harness.ds, project.id);
    const target = kind === 'change' ? { githubId: 96 } : null;
    let outcome: unknown;
    let settled = false;

    await harness.ds.transaction(async (manager) => {
      await manager.getRepository(IssuesProject).findOne({ where: { id: project.id }, lock: { mode: 'pessimistic_write' } });

      const change = service.setRepository(userId, project.uuid, { repository: target }).then(
        (ok) => { outcome = ok; settled = true; },
        (error: unknown) => { outcome = error; settled = true; },
      );

      await until(changeIsWaiting, 'the change to block on the project row lock');
      expect(settled).toBe(false);

      // A link is committed (as a link creation would, under the same lock) before the lock is released.
      await seedLink(harness.ds, { userId, issueId: issue.id });
      void change;
    });

    await until(() => settled, 'the change to settle');

    expect((outcome as { response?: { code?: string; meta?: unknown } }).response).toEqual({
      code: 'PROJECT_HAS_LINKS',
      message: "Unlink the project's issues before changing its repository",
      meta: { linkCount: 1 },
    });
    expect((await harness.ds.getRepository(IssuesProject).findOneByOrFail({ id: project.id })).repositoryId).toBe(951);
  });

  it('succeeds when the lock holder commits without a link', async () => {
    const project = await seedProject(harness.ds, userId, { repositoryId: 951 });
    let settled = false;
    let change: Promise<unknown> = Promise.resolve();

    await harness.ds.transaction(async (manager) => {
      await manager.getRepository(IssuesProject).findOne({ where: { id: project.id }, lock: { mode: 'pessimistic_write' } });
      change = service.setRepository(userId, project.uuid, { repository: { githubId: 96 } }).then(() => { settled = true; });
      await until(changeIsWaiting, 'the change to block on the project row lock');
      expect(settled).toBe(false);
    });

    await change;

    expect((await harness.ds.getRepository(IssuesProject).findOneByOrFail({ id: project.id })).repositoryId).toBe(952);
  });
});
