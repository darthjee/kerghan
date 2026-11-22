import { githubIssue, issue as issueCase } from '../../../integrations/tests/support/github-builders.js';
import { IssuesProject } from '../../entities/issues-project.entity.js';
import { IssuesService } from '../../issues.service.js';
import { buildIssuesHttpDbHarness, post, type IssuesHttpDbHarness } from '../support/issues-http-db-harness.js';
import { seedIssue } from '../support/issues-seeds.js';
import { buildLinkWorld, INTEGRATION_ID, linkApi, type LinkWorld, rowCount, scriptIssue } from '../support/link-fixture.js';
import { lockWaiterOn, until } from '../support/race-helpers.js';

// An attach and a delete of the same issue: both lock the project first, so they never interleave.
describe('Attach versus delete of one issue (real MySQL)', () => {
  let harness: IssuesHttpDbHarness;
  let world: LinkWorld;
  let issues: IssuesService;

  beforeAll(async () => {
    harness = await buildIssuesHttpDbHarness({ KERGHAN_ISSUES_LINK_MAX_PER_WINDOW: '1000' });
    issues = harness.get(IssuesService);
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    world = await buildLinkWorld(harness);
  });

  it('answers 404 and leaves no link when the issue is deleted during the GitHub read', async () => {
    const local = await seedIssue(harness.ds, world.project.id, { title: 'Local' });
    const held = harness.github.hold(INTEGRATION_ID, 'getIssue', 12);
    const pending = linkApi(harness, world).attach(local.uuid).then((response) => response);

    await until(() => harness.github.githubCalls().length === 1, 'the GitHub read to start');
    await post(harness, `/projects/${world.project.uuid}/issues/${local.uuid}/delete.json`, world.cookie).expect(200);

    held.resolve(issueCase(githubIssue({ number: 12, title: 'Local' })));
    const response = await pending;

    expect(response.status).toBe(404);
    expect(response.body.error.message).toBe('Issue not found');
    expect(await rowCount(harness, 'issues_github_links')).toBe(0);
  });

  it('makes a delete that waits on the project lock answer ISSUE_LINKED once the link committed', async () => {
    const local = await seedIssue(harness.ds, world.project.id, { title: 'Local' });
    let outcome: unknown;
    let settled = false;
    let deleting: Promise<unknown> = Promise.resolve();

    scriptIssue(harness, { title: 'Local', body: null });

    await harness.ds.transaction(async (manager) => {
      await manager.getRepository(IssuesProject).findOne({ where: { id: world.project.id }, lock: { mode: 'pessimistic_write' } });

      deleting = issues.delete(world.userId, world.project.uuid, local.uuid).then(
        () => { outcome = 'deleted'; settled = true; },
        (error: unknown) => { outcome = error; settled = true; },
      );

      await until(() => lockWaiterOn(harness.ds, 'issues_projects'), 'the delete to block on the project lock');
      expect(settled).toBe(false);

      // The link, as an attach would commit it under this same lock.
      await manager.query(
        `INSERT INTO issues_github_links (user_id, issue_id, github_issue_id, github_number, status, base_title, base_body, base_state, created_at, updated_at)
         VALUES (?, ?, ?, 12, 'linked', 'Local', NULL, 'open', NOW(), NOW())`,
        [world.userId, local.id, 2 ** 31 + 9_500],
      );
    });

    await deleting;

    expect((outcome as { response?: { code?: string } }).response?.code).toBe('ISSUE_LINKED');
    expect(await rowCount(harness, 'issues')).toBe(1);
    expect(await rowCount(harness, 'issues_github_links')).toBe(1);
  });
});
