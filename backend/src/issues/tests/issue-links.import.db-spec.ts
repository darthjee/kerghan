import { Issue } from '../entities/issue.entity.js';
import { IssueGithubLink } from '../entities/issue-github-link.entity.js';
import { buildIssuesHttpDbHarness, type IssuesHttpDbHarness } from './support/issues-http-db-harness.js';
import { buildLinkWorld, INTEGRATION_ID, linkApi, type LinkWorld, REPOSITORY, rowCount, scriptIssue } from './support/link-fixture.js';
import { seedIssue } from './support/issues-seeds.js';

// POST import.json over real MySQL: the issue and its link are created together from the single
// GitHub read (`docs/agents/specs/issues/api/github-link.md`).
const CAP = 3;

describe('Issue import (real MySQL)', () => {
  let harness: IssuesHttpDbHarness;
  let world: LinkWorld;

  beforeAll(async () => {
    harness = await buildIssuesHttpDbHarness({ KERGHAN_ISSUES_MAX_ISSUES_PER_PROJECT: `${CAP}` });
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    world = await buildLinkWorld(harness);
  });

  const api = () => linkApi(harness, world);
  const storedIssues = (): Promise<Issue[]> => harness.ds.getRepository(Issue).find({ where: { projectId: world.project.id } });
  const storedLink = (): Promise<IssueGithubLink> => harness.ds.getRepository(IssueGithubLink).findOneByOrFail({ userId: world.userId });

  it('creates a linked issue with GitHub\'s values and answers 201 with the link object', async () => {
    const gh = scriptIssue(harness, { title: 'From GitHub', body: 'details', updatedAt: new Date('2026-05-01T08:30:15.900Z') });

    const response = await api().importIssue().expect(201);
    const [row] = await storedIssues();
    const link = await storedLink();

    expect(response.body).toMatchObject({
      id: row.uuid,
      title: 'From GitHub',
      body: 'details',
      state: 'open',
      createdAt: harness.clock.now().toISOString(),
      updatedAt: harness.clock.now().toISOString(),
      link: { number: 12, url: `https://github.com/${REPOSITORY.owner}/${REPOSITORY.name}/issues/12`, state: 'linked', states: ['linked'], reason: null, stale: false },
    });
    expect(link).toMatchObject({
      githubIssueId: gh.id,
      githubNumber: 12,
      status: 'linked',
      statusReason: null,
      etag: `W/"issue-${gh.id}"`,
      githubUpdatedAt: new Date('2026-05-01T08:30:15.000Z'),
    });
    expect(link.lastSyncedAt?.getTime()).toBe(link.createdAt.getTime());
    expect(link.updatedAt.getTime()).toBe(link.createdAt.getTime());
  });

  it('stores a closed GitHub issue as closed', async () => {
    scriptIssue(harness, { state: 'closed' });

    const response = await api().importIssue().expect(201);

    expect(response.body.state).toBe('closed');
    expect((await storedLink()).baseState).toBe('closed');
  });

  it('keeps the base equal to the local columns (the normalization invariant)', async () => {
    scriptIssue(harness, { title: ' Keep  spacing ', body: '  keep  ', state: 'closed' });

    await api().importIssue().expect(201);
    const [row] = await storedIssues();
    const link = await storedLink();

    expect({ title: link.baseTitle, body: link.baseBody, state: link.baseState }).toEqual({ title: row.title, body: row.body, state: row.state });
    expect(row).toMatchObject({ title: ' Keep  spacing ', body: '  keep  ' });
  });

  it.each([[''], [null]])('stores a blank GitHub body (%j) as NULL', async (body) => {
    scriptIssue(harness, { body });

    const response = await api().importIssue().expect(201);
    const [row] = await storedIssues();

    expect(response.body.body).toBeNull();
    expect(row.body).toBeNull();
    expect((await storedLink()).baseBody).toBeNull();
  });

  it('keeps a whitespace-only body as it is (only \'\' and null are blank)', async () => {
    scriptIssue(harness, { body: '  \n' });

    const response = await api().importIssue().expect(201);

    expect(response.body.body).toBe('  \n');
    expect((await storedIssues())[0].body).toBe('  \n');
  });

  it('writes no marker and no job, and makes exactly one getIssue in the project\'s repository', async () => {
    scriptIssue(harness, { number: 12 });

    await api().importIssue({ number: 12 }).expect(201);

    expect(await rowCount(harness, 'issues_pending_writes')).toBe(0);
    expect(harness.github.githubCalls()).toEqual([
      expect.objectContaining({ operation: 'getIssue', userId: world.userId, integrationId: INTEGRATION_ID, number: 12, repo: REPOSITORY }),
    ]);
    expect(harness.github.githubCalls()).toHaveLength(1);
  });

  it('sends no body field or secret of the link to the wire beyond the link object', async () => {
    scriptIssue(harness);

    const response = await api().importIssue().expect(201);

    expect(Object.keys(response.body.link).sort()).toEqual(
      ['lastSyncedAt', 'number', 'rateLimitedUntil', 'reason', 'state', 'states', 'stale', 'url'].sort(),
    );
    expect(response.headers['x-skip-cache']).toBe('true');
  });

  it('refuses with ISSUES_LIMIT_REACHED before any GitHub call when the project is full (pre-check)', async () => {
    for (let index = 0; index < CAP; index += 1) await seedIssue(harness.ds, world.project.id);

    const response = await api().importIssue().expect(409);

    expect(response.body.error.code).toBe('ISSUES_LIMIT_REACHED');
    expect(harness.github.githubCalls()).toEqual([]);
    expect(await rowCount(harness, 'issues_github_links')).toBe(0);
  });

  it('enforces the cap again under the project lock: one slot, two imports, one wins', async () => {
    for (let index = 0; index < CAP - 1; index += 1) await seedIssue(harness.ds, world.project.id);

    scriptIssue(harness, { number: 21 });
    scriptIssue(harness, { number: 22 });

    const outcomes = await Promise.all([21, 22].map(async (number) => (await api().importIssue({ number })).status));

    expect(outcomes.sort()).toEqual([201, 409]);
    expect(await storedIssues()).toHaveLength(CAP);
    expect(await rowCount(harness, 'issues_github_links')).toBe(1);
  });
});
