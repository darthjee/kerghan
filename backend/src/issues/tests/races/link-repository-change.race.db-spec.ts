import { githubIssue, issue as issueCase } from '../../../integrations/tests/support/github-builders.js';
import { IssuesProject } from '../../entities/issues-project.entity.js';
import { ProjectsService } from '../../projects.service.js';
import { buildIssuesHttpDbHarness, type IssuesHttpDbHarness } from '../support/issues-http-db-harness.js';
import { buildLinkWorld, INTEGRATION_ID, linkApi, type LinkWorld, REPOSITORY_ID, rowCount, scriptIssue, seedSecondRepository } from '../support/link-fixture.js';
import { until } from '../support/race-helpers.js';

// The full E62 (`github-link.md#same-repository-rule-and-repository-changes`): the link creation
// re-checks the repository under the project lock that `ProjectRepositoryChanger` takes first, so
// the project never ends with a link against a changed repository.
describe('Link creation versus a repository change (real MySQL)', () => {
  let harness: IssuesHttpDbHarness;
  let world: LinkWorld;
  let projects: ProjectsService;

  beforeAll(async () => {
    harness = await buildIssuesHttpDbHarness({ KERGHAN_ISSUES_LINK_MAX_PER_WINDOW: '1000' });
    projects = harness.get(ProjectsService);
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    world = await buildLinkWorld(harness);
  });

  const repositoryOf = async (): Promise<number | null> => (
    (await harness.ds.getRepository(IssuesProject).findOneByOrFail({ id: world.project.id })).repositoryId
  );
  const change = (githubId: number) => projects.setRepository(world.userId, world.project.uuid, { repository: { githubId } }).then(
    () => 'changed',
    (error: { response?: { code?: string } }) => error.response?.code ?? 'other',
  );

  it('refuses the link with PROJECT_REPOSITORY_CHANGED when the repository changes during the GitHub read', async () => {
    seedSecondRepository(harness, world.userId);
    const held = harness.github.hold(INTEGRATION_ID, 'getIssue', 12);
    const creating = linkApi(harness, world).importIssue();
    const pending = creating.then((response) => response);

    await until(() => harness.github.githubCalls().length === 1, 'the GitHub read to start');

    expect(await change(701)).toBe('changed');
    expect(await repositoryOf()).not.toBe(REPOSITORY_ID);

    held.resolve(issueCase(githubIssue({ number: 12 })));
    const response = await pending;

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('PROJECT_REPOSITORY_CHANGED');
    expect(await rowCount(harness, 'issues_github_links')).toBe(0);
    expect(await rowCount(harness, 'issues')).toBe(0);
  });

  it('refuses the change with PROJECT_HAS_LINKS when the link committed first', async () => {
    seedSecondRepository(harness, world.userId);
    scriptIssue(harness);

    await linkApi(harness, world).importIssue().expect(201);

    expect(await change(701)).toBe('PROJECT_HAS_LINKS');
    expect(await repositoryOf()).toBe(REPOSITORY_ID);
    expect(await rowCount(harness, 'issues_github_links')).toBe(1);
  });

  it('never leaves a link against a changed repository, whichever of the two commits first', async () => {
    seedSecondRepository(harness, world.userId);

    for (let run = 0; run < 5; run += 1) {
      await harness.ds.query('DELETE FROM issues_github_links');
      await harness.ds.query('DELETE FROM issues');
      await harness.ds.getRepository(IssuesProject).update({ id: world.project.id }, { repositoryId: REPOSITORY_ID });
      harness.clock.advance(120_000);
      scriptIssue(harness, { id: 2 ** 31 + 8_000 + run });

      const [linked, changed] = await Promise.all([
        linkApi(harness, world).importIssue().then((response) => response.status),
        change(701),
      ]);
      const links = await rowCount(harness, 'issues_github_links');

      expect(links === 0 || (await repositoryOf()) === REPOSITORY_ID).toBe(true);
      // Either the link won (and the change was refused) or the change won (and the link was).
      expect(`${linked}/${changed}`).toMatch(/^(201\/PROJECT_HAS_LINKS|409\/changed)$/);
    }
  });
});
