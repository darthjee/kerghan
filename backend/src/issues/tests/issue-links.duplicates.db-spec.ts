import { Issue } from '../entities/issue.entity.js';
import { buildIssuesHttpDbHarness, post, type IssuesHttpDbHarness } from './support/issues-http-db-harness.js';
import { seedIssue, seedProject } from './support/issues-seeds.js';
import { addLinkUser, buildLinkWorld, linkApi, type LinkWorld, REPOSITORY_ID, rowCount, scriptIssue, seedSecondProject } from './support/link-fixture.js';

// One GitHub issue is linked at most once per user (E4), by any number of users (E45), and is
// free again once its link is gone (E47).
const GITHUB_ID = 2 ** 31 + 9_000;

describe('Issue link duplicates (real MySQL)', () => {
  let harness: IssuesHttpDbHarness;
  let world: LinkWorld;

  beforeAll(async () => {
    harness = await buildIssuesHttpDbHarness();
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    world = await buildLinkWorld(harness);
    scriptIssue(harness, { id: GITHUB_ID, number: 12 });
  });

  const api = () => linkApi(harness, world);

  it('answers 409 GITHUB_ISSUE_ALREADY_LINKED with the existing project and issue for a second import (E4)', async () => {
    const first = await api().importIssue().expect(201);
    const second = await api().importIssue().expect(409);

    expect(second.body.error).toEqual({
      code: 'GITHUB_ISSUE_ALREADY_LINKED',
      message: expect.any(String),
      meta: { projectId: world.project.uuid, issueId: first.body.id },
    });
    expect(await rowCount(harness, 'issues')).toBe(1);
    expect(await rowCount(harness, 'issues_github_links')).toBe(1);
  });

  it('answers it for an attach from another project, naming the first project, and changes nothing', async () => {
    const first = await api().importIssue().expect(201);
    const other = await seedSecondProject(harness, world.userId);
    const local = await seedIssue(harness.ds, other.id, { title: 'Local' });
    const refused = await post(harness, `/projects/${other.uuid}/issues/${local.uuid}/attach.json`, world.cookie, { number: 12, confirmUpdatedAt: '2026-06-01T12:00:00.000Z' }).expect(409);

    expect(refused.body.error.meta).toEqual({ projectId: world.project.uuid, issueId: first.body.id });
    expect(await rowCount(harness, 'issues_github_links')).toBe(1);
    expect(await harness.ds.getRepository(Issue).findOneByOrFail({ id: local.id })).toMatchObject({ title: 'Local' });
  });

  it('lets two users link the same GitHub issue (E45)', async () => {
    await api().importIssue().expect(201);

    const other = await addLinkUser(harness, 'second');
    const response = await linkApi(harness, other).importIssue().expect(201);

    expect(response.body.link).toMatchObject({ number: 12, state: 'linked' });
    expect(await rowCount(harness, 'issues_github_links')).toBe(2);
  });

  it('frees the GitHub issue when its project is deleted, to link it again from another project (E47)', async () => {
    await api().importIssue().expect(201);

    const deleted = await post(harness, `/projects/${world.project.uuid}/delete.json`, world.cookie).expect(200);

    expect(deleted.body).toBeDefined();
    expect(await rowCount(harness, 'issues_github_links')).toBe(0);

    const other = await seedProject(harness.ds, world.userId, { repositoryId: REPOSITORY_ID, name: 'other' });

    await linkApi(harness, { ...world, project: other }).importIssue().expect(201);

    expect(await rowCount(harness, 'issues_github_links')).toBe(1);
  });
});
