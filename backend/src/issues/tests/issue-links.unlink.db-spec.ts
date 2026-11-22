import { IssueGithubLink } from '../entities/issue-github-link.entity.js';
import { Issue } from '../entities/issue.entity.js';
import { buildIssuesHttpDbHarness, post, type IssuesHttpDbHarness } from './support/issues-http-db-harness.js';
import { seedIssue, seedLink, seedMarker, seedProject } from './support/issues-seeds.js';
import { buildLinkWorld, linkApi, linkRepository, type LinkWorld, rowCount, scriptIssue, seedSecondProject } from './support/link-fixture.js';

// POST unlink.json: local only, in every link state, never a GitHub call (E63, E64).
describe('Issue unlink (real MySQL)', () => {
  let harness: IssuesHttpDbHarness;
  let world: LinkWorld;

  beforeAll(async () => {
    harness = await buildIssuesHttpDbHarness();
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    world = await buildLinkWorld(harness);
  });

  const api = () => linkApi(harness, world);
  const linked = async (status = 'linked', statusReason: string | null = null) => {
    const issue = await seedIssue(harness.ds, world.project.id, { title: 'Local', body: 'body' });
    const link = await seedLink(harness.ds, { userId: world.userId, issueId: issue.id, status, statusReason, githubIssueId: 2 ** 31 + 12 });

    return { issue, link };
  };
  const linkCount = () => harness.ds.getRepository(IssueGithubLink).count();

  it('deletes the link, keeps the issue unchanged, makes no GitHub call and answers link: null', async () => {
    const { issue } = await linked();
    const before = await harness.ds.getRepository(Issue).findOneByOrFail({ id: issue.id });

    const response = await api().unlink(issue.uuid).expect(200);

    expect(response.body).toEqual({
      issue: { id: issue.uuid, title: 'Local', body: 'body', state: 'open', createdAt: before.createdAt.toISOString(), updatedAt: before.updatedAt.toISOString(), link: null },
      droppedUnsentChanges: false,
    });
    expect(await linkCount()).toBe(0);
    expect(await harness.ds.getRepository(Issue).findOneByOrFail({ id: issue.id })).toMatchObject({ title: 'Local', body: 'body', updatedAt: before.updatedAt });
    expect(harness.github.calls).toEqual([]);
  });

  it('frees the GitHub issue: it can be attached again, here or in another project', async () => {
    const { issue } = await linked();

    await api().unlink(issue.uuid).expect(200);
    scriptIssue(harness, { id: 2 ** 31 + 12, number: 12, title: 'Local', body: 'body' });
    await api().attach(issue.uuid).expect(200);
    await api().unlink(issue.uuid).expect(200);

    const other = await seedSecondProject(harness, world.userId);

    await linkApi(harness, { ...world, project: other }).importIssue().expect(201);

    expect(await linkCount()).toBe(1);
  });

  it('refuses with ISSUE_UNLINK_HAS_UNSENT_CHANGES when a marker exists and no flag is sent (E63), changing nothing', async () => {
    const { issue, link } = await linked();

    await seedMarker(harness.ds, link.id);

    const response = await api().unlink(issue.uuid).expect(409);

    expect(response.body.error.code).toBe('ISSUE_UNLINK_HAS_UNSENT_CHANGES');
    expect(await linkCount()).toBe(1);
    expect(await rowCount(harness, 'issues_pending_writes')).toBe(1);

    await api().unlink(issue.uuid, { discardUnsentChanges: false }).expect(409);

    expect(await linkCount()).toBe(1);
    expect(await rowCount(harness, 'issues_pending_writes')).toBe(1);
  });

  it('deletes both and says droppedUnsentChanges: true with the flag (E63)', async () => {
    const { issue, link } = await linked();

    await seedMarker(harness.ds, link.id);

    const response = await api().unlink(issue.uuid, { discardUnsentChanges: true }).expect(200);

    expect(response.body).toMatchObject({ droppedUnsentChanges: true, issue: { link: null } });
    expect(await linkCount()).toBe(0);
    expect(await rowCount(harness, 'issues_pending_writes')).toBe(0);
  });

  it('says droppedUnsentChanges: false when the flag is sent but there is no marker', async () => {
    const { issue } = await linked();

    const response = await api().unlink(issue.uuid, { discardUnsentChanges: true }).expect(200);

    expect(response.body.droppedUnsentChanges).toBe(false);
  });

  it.each([
    ['linked', null],
    ['gone', 'deleted'],
    ['sync_failed', 'conflict'],
  ])('works for a %s link', async (status, reason) => {
    const { issue } = await linked(status, reason);

    await api().unlink(issue.uuid).expect(200);

    expect(await linkCount()).toBe(0);
  });

  it('works while the repository is Unavailable, with no GitHub call', async () => {
    const { issue } = await linked();

    linkRepository(harness, world.userId, 'unavailable');
    await api().unlink(issue.uuid).expect(200);

    expect(await linkCount()).toBe(0);
    expect(harness.github.githubCalls()).toEqual([]);
  });

  it('answers 409 ISSUE_NOT_LINKED for a repeat unlink and for an issue that never had a link (E64)', async () => {
    const { issue } = await linked();
    const plain = await seedIssue(harness.ds, world.project.id);

    await api().unlink(issue.uuid).expect(200);

    expect((await api().unlink(issue.uuid).expect(409)).body.error.code).toBe('ISSUE_NOT_LINKED');
    expect((await api().unlink(plain.uuid).expect(409)).body.error.code).toBe('ISSUE_NOT_LINKED');
  });

  it('answers 404 for a missing issue and an issue of another project, leaving the link in place', async () => {
    const { issue } = await linked();
    const other = await seedProject(harness.ds, world.userId, { name: 'other' });

    await api().unlink('00000000-0000-4000-8000-000000000000').expect(404);
    await post(harness, `/projects/${other.uuid}/issues/${issue.uuid}/unlink.json`, world.cookie, {}).expect(404);

    expect(await linkCount()).toBe(1);
  });
});
