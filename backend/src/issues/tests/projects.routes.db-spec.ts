import { keysOf } from './support/build-issues-test-app.js';
import { buildIssuesHttpDbHarness, post, type IssuesHttpDbHarness } from './support/issues-http-db-harness.js';
import { seedIntruder, seedIssue, seedLink, seedMarker, seedProject } from './support/issues-seeds.js';
import { seedUser } from '../../repositories/tests/support/two-user-baseline.js';

// The Projects routes over real MySQL: the real service behind the controller, so the wire bodies
// are the ones a client sees (`docs/agents/specs/issues/api/projects.md`).
const FORBIDDEN_KEYS = ['userId', 'user_id', 'repositoryId', 'repository_id', 'deletedAt', 'deletedToken', 'integrationId', 'secretHint'];
const MISSING = '00000000-0000-4000-8000-000000000000';

describe('Projects routes (real MySQL)', () => {
  let harness: IssuesHttpDbHarness;
  let userId: number;
  let cookie: string;

  beforeAll(async () => {
    harness = await buildIssuesHttpDbHarness({ KERGHAN_ISSUES_MAX_PROJECTS_PER_USER: '5' });
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    userId = await seedUser(harness.ds, 'owner');
    cookie = harness.sessionFor(userId);
    harness.repositories.seed(userId, { repositoryId: 601, githubId: 61, owner: 'darthjee', name: 'kerghan' });
    harness.repositories.seed(userId, { repositoryId: 602, githubId: 62, owner: 'darthjee', name: 'unavailable', status: 'unavailable' });
    harness.repositories.seed(userId, { repositoryId: 603, githubId: 63, owner: 'darthjee', name: 'unknown', status: 'unknown' });
    harness.repositories.seed(userId, { repositoryId: 604, githubId: 64, owner: 'darthjee', name: 'draft', added: false });
  });

  const call = (path: string, body: Record<string, unknown> = {}, as = cookie) => post(harness, path, as, body);

  it('creates, shows, edits, changes the repository and deletes a project end to end', async () => {
    const created = await call('/projects/create.json', { name: ' Kerghan ', description: ' the app ' }).expect(201);

    expect(created.body).toMatchObject({ name: 'Kerghan', description: 'the app', repository: null, openIssueCount: 0 });

    const id = created.body.id as string;

    await call(`/projects/${id}/repository.json`, { repository: { fullName: 'DarthJee/Kerghan' } }).expect(200);
    const shown = await call(`/projects/${id}/show.json`).expect(200);

    expect(shown.body.repository).toEqual({
      githubId: 61, owner: 'darthjee', name: 'kerghan', fullName: 'darthjee/kerghan', private: false, status: 'added',
    });

    const edited = await call(`/projects/${id}/edit.json`, { description: null }).expect(200);

    expect(edited.body.description).toBeNull();
    expect((await call('/projects/mine.json').expect(200)).body.projects).toHaveLength(1);

    expect((await call(`/projects/${id}/delete.json`).expect(200)).body).toEqual({ unsentIssueCount: 0 });
    expect((await call('/projects/mine.json').expect(200)).body.projects).toEqual([]);
    await call(`/projects/${id}/show.json`).expect(404);
    await call(`/projects/${id}/delete.json`).expect(404);
  });

  it('answers the shortcut with 201 then 200, and the explicit path with 409 and meta.projectId', async () => {
    const first = await call('/projects/from-repository.json', { repository: { githubId: 61 } }).expect(201);
    const again = await call('/projects/from-repository.json', { repository: { githubId: 61 }, name: 'ignored' }).expect(200);
    const taken = await call('/projects/create.json', { name: 'Other', repository: { githubId: 61 } }).expect(409);

    expect(first.body.name).toBe('darthjee/kerghan');
    expect(again.body).toEqual(first.body);
    expect(taken.body.error).toEqual({
      code: 'PROJECT_REPOSITORY_TAKEN',
      message: 'This repository already has a project',
      meta: { projectId: first.body.id },
    });
  });

  it('carries meta.linkCount on PROJECT_HAS_LINKS and nothing but ids, counts and messages in any error', async () => {
    const project = await seedProject(harness.ds, userId, { repositoryId: 601 });
    const issue = await seedIssue(harness.ds, project.id);
    await seedLink(harness.ds, { userId, issueId: issue.id });

    const refused = await call(`/projects/${project.uuid}/repository.json`, { repository: null }).expect(409);

    expect(refused.body.error).toEqual({
      code: 'PROJECT_HAS_LINKS',
      message: "Unlink the project's issues before changing its repository",
      meta: { linkCount: 1 },
    });
  });

  it('reports unsentIssueCount for a project with markers', async () => {
    const project = await seedProject(harness.ds, userId);
    const issue = await seedIssue(harness.ds, project.id);
    const link = await seedLink(harness.ds, { userId, issueId: issue.id });
    await seedMarker(harness.ds, link.id);

    expect((await call(`/projects/${project.uuid}/delete.json`).expect(200)).body).toEqual({ unsentIssueCount: 1 });
  });

  describe('E39: a repository that is Unavailable or Unknown at creation', () => {
    it.each([[62, 'unavailable'], [63, 'unknown']])('allows creating on githubId %i and reads its status %s', async (githubId, status) => {
      const created = await call('/projects/create.json', { name: `on ${status}`, repository: { githubId } }).expect(201);

      expect(created.body.repository.status).toBe(status);
    });

    it('refuses a repository that is not added with 409 PROJECT_REPOSITORY_NOT_ADDED', async () => {
      const refused = await call('/projects/create.json', { name: 'x', repository: { githubId: 64 } }).expect(409);

      expect(refused.body.error.code).toBe('PROJECT_REPOSITORY_NOT_ADDED');
    });
  });

  describe('E29, E37: a repository renamed on GitHub', () => {
    it('leaves the project untouched and reads the current owner/name in its summary', async () => {
      const created = await call('/projects/create.json', { name: 'Tracked', repository: { githubId: 61 } }).expect(201);
      const stored = await harness.ds.query('SELECT name, repository_id FROM issues_projects WHERE uuid = ?', [created.body.id]);

      harness.repositories.rename(userId, 601, 'newowner', 'newname');
      const shown = await call(`/projects/${created.body.id}/show.json`).expect(200);

      expect(stored).toEqual([{ name: 'Tracked', repository_id: 601 }]);
      expect(shown.body.name).toBe('Tracked');
      expect(shown.body.repository).toMatchObject({ githubId: 61, owner: 'newowner', name: 'newname', fullName: 'newowner/newname' });
      expect((await call('/projects/mine.json').expect(200)).body.projects[0].repository.fullName).toBe('newowner/newname');
    });
  });

  describe('a dangling repository reference', () => {
    it('reads unavailable with null snapshot fields, in show and in the listing', async () => {
      const project = await seedProject(harness.ds, userId, { name: 'dangling', repositoryId: 999 });
      const expected = { githubId: null, owner: null, name: null, fullName: null, private: null, status: 'unavailable' };

      expect((await call(`/projects/${project.uuid}/show.json`).expect(200)).body.repository).toEqual(expected);
      expect((await call('/projects/mine.json').expect(200)).body.projects[0].repository).toEqual(expected);
    });
  });

  describe('access', () => {
    it('answers a missing, a foreign and a deleted project with the identical 404 on every :projectId route', async () => {
      const intruder = await seedIntruder(harness.ds);
      const deleted = await seedProject(harness.ds, userId, { deleted: true });
      const routes: Array<[string, Record<string, unknown>]> = [
        ['show', {}], ['edit', { name: 'x' }], ['repository', { repository: null }], ['delete', {}],
      ];

      for (const [action, body] of routes) {
        const answers = await Promise.all([MISSING, intruder.projectUuid, deleted.uuid].map((uuid) => call(`/projects/${uuid}/${action}.json`, body)));

        expect(answers.map((answer) => answer.status)).toEqual([404, 404, 404]);
        expect(new Set(answers.map((answer) => JSON.stringify({ ...answer.body, timestamp: null }))).size).toBe(1);
        expect(answers[0].body.error.message).toBe('Project not found');
      }

      await expect(harness.ds.query('SELECT name FROM issues_projects WHERE id = ?', [intruder.projectId]))
        .resolves.toEqual([{ name: 'intruder project' }]);
    });

    it('never lists another user\'s project', async () => {
      await seedIntruder(harness.ds);
      await seedProject(harness.ds, userId, { name: 'mine' });

      const listing = (await call('/projects/mine.json').expect(200)).body;

      expect(listing.projects.map((project: { name: string }) => project.name)).toEqual(['mine']);
      expect(JSON.stringify(listing)).not.toContain('intruder');
    });

    it('treats another user\'s repository ref exactly like a missing one', async () => {
      const intruder = await seedIntruder(harness.ds);
      harness.repositories.seed(intruder.userId, { repositoryId: 698, githubId: 98, owner: 'evil', name: 'secret' });

      const foreign = await call('/projects/create.json', { name: 'x', repository: { githubId: 98 } }).expect(404);
      const missing = await call('/projects/create.json', { name: 'x', repository: { githubId: 12345 } }).expect(404);

      expect({ ...foreign.body, timestamp: null }).toEqual({ ...missing.body, timestamp: null });
      expect(foreign.body.error.message).toBe('Repository not found');
    });

    it('never puts an internal id, the owner or a repository id in any body, and sends no-store headers', async () => {
      const created = await call('/projects/create.json', { name: 'Leak', repository: { githubId: 61 } }).expect(201);
      const bodies = [
        created,
        await call('/projects/mine.json').expect(200),
        await call(`/projects/${created.body.id}/show.json`).expect(200),
        await call(`/projects/${created.body.id}/edit.json`, { name: 'Leak 2' }).expect(200),
      ];

      for (const response of bodies) {
        expect(response.headers['x-skip-cache']).toBe('true');
        expect(response.headers['cache-control']).toBe('no-store');
        FORBIDDEN_KEYS.forEach((key) => expect(keysOf(response.body)).not.toContain(key));
      }

      expect(keysOf(created.body).sort()).toEqual([
        'createdAt', 'description', 'fullName', 'githubId', 'id', 'name', 'name', 'openIssueCount', 'owner', 'private', 'repository',
        'status', 'updatedAt',
      ]);
    });
  });

  describe('the live-project cap from the environment (5 here)', () => {
    it('answers 409 PROJECTS_LIMIT_REACHED over HTTP once the cap is reached', async () => {
      for (const name of ['a', 'b', 'c', 'd', 'e']) await call('/projects/create.json', { name }).expect(201);

      const refused = await call('/projects/create.json', { name: 'f' }).expect(409);

      expect(refused.body.error).toEqual({ code: 'PROJECTS_LIMIT_REACHED', message: 'You reached the maximum number of projects' });
    });
  });
});
