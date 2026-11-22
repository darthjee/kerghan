import { snapshotIntruder } from './support/intruder-baseline.js';
import { buildIssuesHttpDbHarness, post, type IssuesHttpDbHarness } from './support/issues-http-db-harness.js';
import { seedIssue, seedProject } from './support/issues-seeds.js';
import { seedUser } from '../../repositories/tests/support/two-user-baseline.js';

const MISSING = '00000000-0000-4000-8000-000000000000';

/** One route that takes a `:projectId`, with the path and a body it accepts once the ids resolve. */
interface Route {
  path: (projectId: string, issueId: string) => string;
  body: Record<string, unknown>;
  /** Whether the route also takes an `:issueId`. */
  takesIssue: boolean;
}

// Every route of the Issues module with a path id (the three that take none are in the access matrix):
// the table keeps a new route from slipping past the identical-404 rule.
const ROUTES: Array<[string, Route]> = [
  ['projects show', { path: (p) => `/projects/${p}/show.json`, body: {}, takesIssue: false }],
  ['projects edit', { path: (p) => `/projects/${p}/edit.json`, body: { name: 'New' }, takesIssue: false }],
  ['projects repository', { path: (p) => `/projects/${p}/repository.json`, body: { repository: null }, takesIssue: false }],
  ['projects delete', { path: (p) => `/projects/${p}/delete.json`, body: {}, takesIssue: false }],
  ['issues list', { path: (p) => `/projects/${p}/issues.json`, body: {}, takesIssue: false }],
  ['issues create', { path: (p) => `/projects/${p}/issues/create.json`, body: { title: 'x' }, takesIssue: false }],
  ['issues show', { path: (p, i) => `/projects/${p}/issues/${i}/show.json`, body: {}, takesIssue: true }],
  ['issues edit', { path: (p, i) => `/projects/${p}/issues/${i}/edit.json`, body: { title: 'x' }, takesIssue: true }],
  ['issues delete', { path: (p, i) => `/projects/${p}/issues/${i}/delete.json`, body: {}, takesIssue: true }],
  ['links import', { path: (p) => `/projects/${p}/issues/import.json`, body: { number: 12 }, takesIssue: false }],
  ['links attach', { path: (p, i) => `/projects/${p}/issues/${i}/attach.json`, body: { number: 12 }, takesIssue: true }],
  ['links unlink', { path: (p, i) => `/projects/${p}/issues/${i}/unlink.json`, body: {}, takesIssue: true }],
  ['links refresh issue', { path: (p, i) => `/projects/${p}/issues/${i}/refresh.json`, body: {}, takesIssue: true }],
  ['links refresh project', { path: (p) => `/projects/${p}/refresh.json`, body: {}, takesIssue: false }],
  ['links retry-sync', { path: (p, i) => `/projects/${p}/issues/${i}/retry-sync.json`, body: {}, takesIssue: true }],
];

// The real-database 404 identity of `testing.md#security-verification`: a project that belongs to
// another user, is deleted or never existed answers byte-identical bodies; so does an issue of another
// user, of another project or that never existed; and an admin session gets no wider view.
describe('Issues routes: the identical 404 (real MySQL)', () => {
  let harness: IssuesHttpDbHarness;
  let userId: number;
  let cookie: string;

  beforeAll(async () => {
    harness = await buildIssuesHttpDbHarness({ KERGHAN_ISSUES_EDIT_MAX_PER_WINDOW: '1000', KERGHAN_ISSUES_LINK_MAX_PER_WINDOW: '1000' });
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    userId = await seedUser(harness.ds, 'owner');
    cookie = harness.sessionFor(userId);
  });

  const call = (route: Route, projectId: string, issueId: string, as = cookie) => post(harness, route.path(projectId, issueId), as, route.body);
  const body = (answer: { body: Record<string, unknown> }) => JSON.stringify({ ...answer.body, timestamp: null });

  it.each(ROUTES)('%s: a foreign, a deleted and a missing project answer the identical 404', async (_name, route) => {
    const { intruder } = harness;
    const deleted = await seedProject(harness.ds, userId, { deleted: true });
    const before = await snapshotIntruder(harness.ds, intruder);
    const answers = [];

    for (const projectId of [intruder.projectUuid, deleted.uuid, MISSING]) answers.push(await call(route, projectId, intruder.issueUuid));

    expect(answers.map((answer) => answer.status)).toEqual([404, 404, 404]);
    expect(new Set(answers.map(body)).size).toBe(1);
    expect(answers[0].body.error.message).toBe('Project not found');
    expect(await snapshotIntruder(harness.ds, intruder)).toEqual(before);
  });

  it.each(ROUTES.filter(([, route]) => route.takesIssue))('%s: an issue of another user, of another project and a missing one answer the identical 404', async (_name, route) => {
    const { intruder } = harness;
    const mine = await seedProject(harness.ds, userId, { name: 'mine' });
    const other = await seedProject(harness.ds, userId, { name: 'other' });
    const elsewhere = await seedIssue(harness.ds, other.id, { title: 'in other' });
    const before = await snapshotIntruder(harness.ds, intruder);
    const answers = [];

    for (const issueId of [intruder.issueUuid, elsewhere.uuid, MISSING]) answers.push(await call(route, mine.uuid, issueId));

    expect(answers.map((answer) => answer.status)).toEqual([404, 404, 404]);
    expect(new Set(answers.map(body)).size).toBe(1);
    expect(answers[0].body.error.message).toBe('Issue not found');
    expect(await snapshotIntruder(harness.ds, intruder)).toEqual(before);
    await expect(harness.ds.query('SELECT title FROM issues WHERE id = ?', [elsewhere.id])).resolves.toEqual([{ title: 'in other' }]);
  });

  it.each(ROUTES)('%s: an admin session gets the same 404 on the intruder\'s project as on a missing one', async (_name, route) => {
    const { intruder } = harness;
    const admin = harness.sessionFor(await seedUser(harness.ds, 'admin'), true);
    const before = await snapshotIntruder(harness.ds, intruder);
    const answers = [];

    for (const projectId of [intruder.projectUuid, MISSING]) answers.push(await call(route, projectId, intruder.issueUuid, admin));

    expect(answers.map((answer) => answer.status)).toEqual([404, 404]);
    expect(new Set(answers.map(body)).size).toBe(1);
    expect(await snapshotIntruder(harness.ds, intruder)).toEqual(before);
  });
});
