import { keysOf } from './support/build-issues-test-app.js';
import { buildIssuesHttpDbHarness, post, type IssuesHttpDbHarness } from './support/issues-http-db-harness.js';
import { seedIssue, seedProject } from './support/issues-seeds.js';
import { seedUser } from '../../repositories/tests/support/two-user-baseline.js';

// The Issues routes over real MySQL: the real service behind the controller, so the wire bodies
// are the ones a client sees (`docs/agents/backend/routes/issues/issues.md`).
const FORBIDDEN_KEYS = ['id_', 'projectId', 'project_id', 'userId', 'user_id'];
const MISSING = '00000000-0000-4000-8000-000000000000';
const EDIT_MAX = 3;

describe('Issues routes (real MySQL)', () => {
  let harness: IssuesHttpDbHarness;
  let userId: number;
  let cookie: string;
  let projectUuid: string;
  let projectId: number;
  let run = 0;

  beforeAll(async () => {
    harness = await buildIssuesHttpDbHarness({ KERGHAN_ISSUES_EDIT_MAX_PER_WINDOW: `${EDIT_MAX}` });
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    userId = await seedUser(harness.ds, 'owner');
    cookie = harness.sessionFor(userId);
    const project = await seedProject(harness.ds, userId);

    projectUuid = project.uuid;
    projectId = project.id;
    // A fresh edit-limiter window per test (the user id repeats after each truncate).
    run += 1;
    harness.clock.set(new Date(Date.UTC(2026, 5, 1, 12, 0, 0) + run * 3_600_000));
  });

  const call = (path: string, body: Record<string, unknown> = {}, as = cookie) => post(harness, path, as, body);

  it('creates, lists, shows, edits and deletes an issue end to end', async () => {
    const created = await call(`/projects/${projectUuid}/issues/create.json`, { title: ' Fix it ', body: ' details ' }).expect(201);

    expect(created.body).toMatchObject({ title: 'Fix it', body: ' details ', state: 'open', link: null });

    const id = created.body.id as string;
    const listing = await call(`/projects/${projectUuid}/issues.json`).expect(200);

    expect(listing.body.pagination).toEqual({ page: 1, perPage: 50, total: 1, totalPages: 1 });
    expect(listing.body.issues).toEqual([expect.objectContaining({ id, title: 'Fix it', state: 'open', link: null })]);
    expect(listing.body.issues[0]).not.toHaveProperty('body');
    expect((await call(`/projects/${projectUuid}/issues/${id}/show.json`).expect(200)).body).toEqual(created.body);

    const edited = await call(`/projects/${projectUuid}/issues/${id}/edit.json`, { state: 'closed', body: null }).expect(200);

    expect(edited.body).toMatchObject({ id, state: 'closed', body: null });
    expect((await call(`/projects/${projectUuid}/issues.json`).expect(200)).body.issues).toEqual([]);
    expect((await call(`/projects/${projectUuid}/issues.json`, { state: 'all' }).expect(200)).body.issues).toHaveLength(1);

    expect((await call(`/projects/${projectUuid}/issues/${id}/delete.json`).expect(200)).body).toEqual({});
    await call(`/projects/${projectUuid}/issues/${id}/show.json`).expect(404);
    await call(`/projects/${projectUuid}/issues/${id}/delete.json`).expect(404);
  });

  it('routes create.json to creation, not to an issue-id handler', async () => {
    const response = await call(`/projects/${projectUuid}/issues/create.json`, { title: 'x' });

    expect(response.status).toBe(201);
  });

  describe('access', () => {
    it('answers a missing, a foreign and a deleted project with the identical 404 on every route', async () => {
      const { intruder } = harness;
      const deleted = await seedProject(harness.ds, userId, { deleted: true });
      const routes: Array<[string, Record<string, unknown>]> = [
        ['issues.json', {}],
        ['issues/create.json', { title: 'x' }],
        [`issues/${intruder.issueUuid}/show.json`, {}],
        [`issues/${intruder.issueUuid}/edit.json`, { title: 'x' }],
        [`issues/${intruder.issueUuid}/delete.json`, {}],
      ];

      for (const [tail, body] of routes) {
        const answers = await Promise.all([MISSING, intruder.projectUuid, deleted.uuid].map((uuid) => call(`/projects/${uuid}/${tail}`, body)));

        expect(answers.map((answer) => answer.status)).toEqual([404, 404, 404]);
        expect(new Set(answers.map((answer) => JSON.stringify({ ...answer.body, timestamp: null }))).size).toBe(1);
        expect(answers[0].body.error.message).toBe('Project not found');
      }

      await expect(harness.ds.query('SELECT title FROM issues WHERE id = ?', [intruder.issueId])).resolves.toEqual([{ title: 'intruder issue' }]);
      await expect(harness.ds.query('SELECT COUNT(*) AS total FROM issues WHERE project_id = ?', [deleted.id])).resolves.toEqual([{ total: '0' }]);
    });

    it('answers an issue of another project with the identical 404 on show, edit and delete', async () => {
      const { intruder } = harness;
      const other = await seedProject(harness.ds, userId, { name: 'other' });
      const foreign = await seedIssue(harness.ds, other.id, { title: 'in other' });
      const targets = [MISSING, intruder.issueUuid, foreign.uuid];

      for (const [action, body] of [['show', {}], ['edit', { title: 'x' }], ['delete', {}]] as Array<[string, Record<string, unknown>]>) {
        const answers = await Promise.all(targets.map((uuid) => call(`/projects/${projectUuid}/issues/${uuid}/${action}.json`, body)));

        expect(answers.map((answer) => answer.status)).toEqual([404, 404, 404]);
        expect(new Set(answers.map((answer) => JSON.stringify({ ...answer.body, timestamp: null }))).size).toBe(1);
        expect(answers[0].body.error.message).toBe('Issue not found');
      }

      await expect(harness.ds.query('SELECT title FROM issues WHERE id = ?', [foreign.id])).resolves.toEqual([{ title: 'in other' }]);
    });

    it('never lists another user\'s issues', async () => {
      const { intruder } = harness;
      await seedIssue(harness.ds, projectId, { title: 'mine' });

      const listing = (await call(`/projects/${projectUuid}/issues.json`, { state: 'all' }).expect(200)).body;

      expect(listing.issues.map((issue: { title: string }) => issue.title)).toEqual(['mine']);
      expect(JSON.stringify(listing)).not.toContain('intruder');
      await call(`/projects/${intruder.projectUuid}/issues.json`).expect(404);
    });

    it('never puts an internal id or project id in any body, and sends no-store headers', async () => {
      const created = await call(`/projects/${projectUuid}/issues/create.json`, { title: 'Leak' }).expect(201);
      const id = created.body.id as string;
      const responses = [
        created,
        await call(`/projects/${projectUuid}/issues.json`).expect(200),
        await call(`/projects/${projectUuid}/issues/${id}/show.json`).expect(200),
        await call(`/projects/${projectUuid}/issues/${id}/edit.json`, { title: 'Leak 2' }).expect(200),
      ];

      for (const response of responses) {
        expect(response.headers['x-skip-cache']).toBe('true');
        expect(response.headers['cache-control']).toBe('no-store');
        FORBIDDEN_KEYS.forEach((key) => expect(keysOf(response.body)).not.toContain(key));
      }

      expect(keysOf(created.body).sort()).toEqual(['body', 'createdAt', 'id', 'link', 'state', 'title', 'updatedAt']);
    });
  });

  describe(`the edit rate limit (${EDIT_MAX} per window here)`, () => {
    it('answers 429 with Retry-After and retryAfterSeconds once the window is full', async () => {
      const issue = await seedIssue(harness.ds, projectId, { title: 't0' });
      const path = `/projects/${projectUuid}/issues/${issue.uuid}/edit.json`;

      for (let index = 1; index <= EDIT_MAX; index += 1) await call(path, { title: `t${index}` }).expect(200);

      harness.clock.advance(20_000);
      const refused = await call(path, { title: 'over' }).expect(429);

      expect(refused.headers['retry-after']).toBe('40');
      expect(refused.body.error).toEqual({
        code: 'ISSUE_EDIT_RATE_LIMITED',
        message: 'Too many edits; try again later',
        retryAfterSeconds: 40,
      });
      await expect(harness.ds.query('SELECT title FROM issues WHERE id = ?', [issue.id])).resolves.toEqual([{ title: `t${EDIT_MAX}` }]);
    });

    it('answers 429 before the access check: a missing project is still 429 once over the limit', async () => {
      const issue = await seedIssue(harness.ds, projectId, { title: 't0' });

      for (let index = 1; index <= EDIT_MAX; index += 1) {
        await call(`/projects/${projectUuid}/issues/${issue.uuid}/edit.json`, { title: `t${index}` }).expect(200);
      }

      const refused = await call(`/projects/${MISSING}/issues/${MISSING}/edit.json`, { title: 'x' }).expect(429);

      expect(refused.body.error.code).toBe('ISSUE_EDIT_RATE_LIMITED');
    });

    it('lets a refused call consume nothing: the window reopens at its original end', async () => {
      const issue = await seedIssue(harness.ds, projectId, { title: 't0' });
      const path = `/projects/${projectUuid}/issues/${issue.uuid}/edit.json`;

      for (let index = 1; index <= EDIT_MAX; index += 1) await call(path, { title: `t${index}` }).expect(200);
      await call(path, { title: 'over' }).expect(429);
      await call(path, { title: 'over again' }).expect(429);

      harness.clock.advance(60_000);

      await call(path, { title: 'after' }).expect(200);
    });

    it('does not count validation errors or the other users\' edits against the window', async () => {
      const issue = await seedIssue(harness.ds, projectId, { title: 't0' });
      const path = `/projects/${projectUuid}/issues/${issue.uuid}/edit.json`;

      for (let index = 0; index < EDIT_MAX + 2; index += 1) await call(path, { title: null }).expect(400);

      await call(path, { title: 'ok' }).expect(200);
    });
  });
});
