import { IssueGithubLink } from '../entities/issue-github-link.entity.js';
import { Issue } from '../entities/issue.entity.js';
import { buildIssuesHttpDbHarness, post, type IssuesHttpDbHarness } from './support/issues-http-db-harness.js';
import { seedIssue, seedLink, seedProject } from './support/issues-seeds.js';
import { buildLinkWorld, linkApi, type LinkWorld, rowCount, scriptIssue } from './support/link-fixture.js';

// POST attach.json over real MySQL: equal values link at once; differing values need the
// confirmation of the issue's exact `updatedAt` (`api/github-link.md#attach`).
describe('Issue attach (real MySQL)', () => {
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
  const issueRow = (id: number): Promise<Issue> => harness.ds.getRepository(Issue).findOneByOrFail({ id });
  const linkOf = (issueId: number): Promise<IssueGithubLink | null> => harness.ds.getRepository(IssueGithubLink).findOneBy({ issueId });
  const seedLocal = (seed: { title?: string; body?: string | null; state?: 'open' | 'closed' } = {}) => (
    seedIssue(harness.ds, world.project.id, { title: 'Local', body: 'local body', ...seed })
  );

  it('E61: links an issue with equal values at once, with no confirmation and no issue write', async () => {
    const local = await seedLocal({ title: 'Same', body: 'same body' });
    const before = await issueRow(local.id);
    const gh = scriptIssue(harness, { title: 'Same', body: 'same body' });

    const response = await api().attach(local.uuid).expect(200);
    const link = await linkOf(local.id);

    expect(response.body).toMatchObject({ id: local.uuid, title: 'Same', link: { number: 12, state: 'linked' } });
    expect(link).toMatchObject({ githubIssueId: gh.id, githubNumber: 12, baseTitle: 'Same', baseBody: 'same body', baseState: 'open' });
    expect((await issueRow(local.id)).updatedAt.getTime()).toBe(before.updatedAt.getTime());
    expect(await rowCount(harness, 'issues_pending_writes')).toBe(0);
  });

  it('treats a NULL local body and an empty GitHub body as equal', async () => {
    const local = await seedLocal({ body: null });

    scriptIssue(harness, { title: 'Local', body: '' });

    await api().attach(local.uuid).expect(200);

    expect(await linkOf(local.id)).not.toBeNull();
  });

  it('E61: answers 409 ISSUE_ATTACH_CONFIRMATION_REQUIRED with the differences and updatedAt, changing nothing', async () => {
    const local = await seedLocal();

    scriptIssue(harness, { title: 'Remote', body: 'local body', state: 'closed' });

    const response = await api().attach(local.uuid).expect(409);

    expect(response.body.error).toEqual({
      code: 'ISSUE_ATTACH_CONFIRMATION_REQUIRED',
      message: expect.any(String),
      meta: { differences: ['title', 'state'], updatedAt: '2026-06-01T12:00:00.000Z' },
    });
    expect(await linkOf(local.id)).toBeNull();
    expect(await issueRow(local.id)).toMatchObject({ title: 'Local', body: 'local body', state: 'open' });
  });

  it('E61: replaces the values on the current updatedAt, sets the base to the local values and writes nothing to GitHub', async () => {
    const local = await seedLocal();

    scriptIssue(harness, { title: 'Remote', body: null, state: 'closed' });
    harness.clock.advance(250);

    const response = await api().attach(local.uuid, { number: 12, confirmUpdatedAt: '2026-06-01T12:00:00.000Z' }).expect(200);
    const row = await issueRow(local.id);
    const link = await linkOf(local.id);

    expect(response.body).toMatchObject({ title: 'Remote', body: null, state: 'closed', updatedAt: harness.clock.now().toISOString() });
    expect(row).toMatchObject({ title: 'Remote', body: null, state: 'closed' });
    expect(row.updatedAt.getTime()).toBe(harness.clock.now().getTime());
    expect({ title: link?.baseTitle, body: link?.baseBody, state: link?.baseState }).toEqual({ title: 'Remote', body: null, state: 'closed' });
    expect(await rowCount(harness, 'issues_pending_writes')).toBe(0);
    expect(harness.github.githubCalls().map((entry) => entry.operation)).toEqual(['getIssue']);
  });

  it('E61: changes nothing for a stale confirmation, even when the edit happened in the same second as the warning', async () => {
    const created = await post(harness, `/projects/${world.project.uuid}/issues/create.json`, world.cookie, { title: 'Local' }).expect(201);
    const issueId = created.body.id as string;
    const internal = (await harness.ds.getRepository(Issue).findOneByOrFail({ uuid: issueId })).id;

    harness.clock.advance(100);
    scriptIssue(harness, { title: 'Remote', body: null });

    const warning = await api().attach(issueId).expect(409);
    const warned = warning.body.error.meta.updatedAt as string;

    // An edit 300 ms later, inside the same second: updatedAt moves, only the milliseconds differ.
    harness.clock.advance(300);
    await post(harness, `/projects/${world.project.uuid}/issues/${issueId}/edit.json`, world.cookie, { title: 'Edited' }).expect(200);

    const stale = await api().attach(issueId, { number: 12, confirmUpdatedAt: warned }).expect(409);

    expect(stale.body.error.meta.updatedAt).not.toBe(warned);
    expect(stale.body.error.meta.updatedAt.slice(0, 19)).toBe(warned.slice(0, 19));
    expect(stale.body.error.meta.differences).toEqual(['title']);
    expect(await linkOf(internal)).toBeNull();
    expect(await issueRow(internal)).toMatchObject({ title: 'Edited' });

    await api().attach(issueId, { number: 12, confirmUpdatedAt: stale.body.error.meta.updatedAt }).expect(200);

    expect(await issueRow(internal)).toMatchObject({ title: 'Remote', body: null });
  });

  it('ignores a confirmation sent while the values are equal', async () => {
    const local = await seedLocal({ title: 'Same', body: null });

    scriptIssue(harness, { title: 'Same', body: null });

    await api().attach(local.uuid, { number: 12, confirmUpdatedAt: '2020-01-01T00:00:00.000Z' }).expect(200);

    expect(await linkOf(local.id)).not.toBeNull();
    expect((await issueRow(local.id)).updatedAt.getTime()).toBe(new Date('2026-06-01T12:00:00.000Z').getTime());
  });

  it('answers 409 ISSUE_ALREADY_LINKED for a linked issue, before any GitHub call (E64)', async () => {
    const local = await seedLocal();

    await seedLink(harness.ds, { userId: world.userId, issueId: local.id });

    const response = await api().attach(local.uuid).expect(409);

    expect(response.body.error.code).toBe('ISSUE_ALREADY_LINKED');
    expect(harness.github.githubCalls()).toEqual([]);
  });

  it('answers 404 for an issue that is not in the project, with no GitHub call', async () => {
    const otherProject = await seedProject(harness.ds, world.userId, { name: 'other' });
    const other = await seedIssue(harness.ds, otherProject.id);

    await api().attach(other.uuid).expect(404);
    await api().attach('00000000-0000-4000-8000-000000000000').expect(404);

    expect(harness.github.githubCalls()).toEqual([]);
  });
});
