import 'reflect-metadata';
import { CacheClass } from '../../core/cache-class.js';
import { CACHE_CLASS_KEY } from '../../core/cache-policy.decorator.js';
import { IssueLinksController } from '../issue-links.controller.js';
import { expectNoForbiddenKeys, keysOf } from './support/build-issues-test-app.js';
import { buildIssuesHttpDbHarness, post, type IssuesHttpDbHarness } from './support/issues-http-db-harness.js';
import { seedIssue, seedLink, seedMarker } from './support/issues-seeds.js';
import { buildLinkWorld, linkApi, type LinkWorld, scriptIssue } from './support/link-fixture.js';

// The link routes over the real service, and the link object they put on show, the listing and
// delete (`api/github-link.md`, `api/issues.md`).
describe('Issue link routes (real MySQL)', () => {
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
  const issuePath = (uuid: string, action: string) => `/projects/${world.project.uuid}/issues/${uuid}/${action}.json`;

  it.each(['import', 'attach', 'unlink'])('declares %s user-scoped', (method) => {
    const handler = (IssueLinksController.prototype as unknown as Record<string, object>)[method];

    expect(Reflect.getMetadata(CACHE_CLASS_KEY, handler) ?? Reflect.getMetadata(CACHE_CLASS_KEY, IssueLinksController)).toBe(CacheClass.UserScoped);
  });

  it('sends the no-store headers on every link response, success or not, and no internal id', async () => {
    scriptIssue(harness);

    const imported = await api().importIssue().expect(201);
    const duplicate = await api().importIssue().expect(409);
    const unlinked = await api().unlink(imported.body.id as string).expect(200);
    const invalid = await api().importIssue({ number: 'x' }).expect(400);

    for (const response of [imported, duplicate, unlinked, invalid]) {
      expect(response.headers['x-skip-cache']).toBe('true');
      expect(response.headers['cache-control']).toBe('no-store');
    }

    // The duplicate's `meta` carries the public ids by design (`projectId`, `issueId`).
    for (const response of [imported, unlinked, invalid]) expectNoForbiddenKeys(response.body);

    expect(keysOf(imported.body).sort()).toEqual(
      ['body', 'createdAt', 'id', 'lastSyncedAt', 'link', 'number', 'rateLimitedUntil', 'reason', 'state', 'state', 'states', 'stale', 'title', 'updatedAt', 'url'].sort(),
    );
  });

  it('shows the link object on show and on the listing, null for an unlinked issue', async () => {
    scriptIssue(harness, { title: 'Linked' });

    const imported = await api().importIssue().expect(201);
    const plain = await seedIssue(harness.ds, world.project.id, { title: 'Plain' });
    const shown = await post(harness, issuePath(imported.body.id as string, 'show'), world.cookie).expect(200);
    const listing = await post(harness, `/projects/${world.project.uuid}/issues.json`, world.cookie, { state: 'all' }).expect(200);
    const byId = new Map((listing.body.issues as Array<{ id: string; link: unknown }>).map((issue) => [issue.id, issue.link]));

    expect(shown.body.link).toEqual(imported.body.link);
    expect(byId.get(imported.body.id as string)).toEqual(imported.body.link);
    expect(byId.get(plain.uuid)).toBeNull();
  });

  it('shows a pending link while a marker exists', async () => {
    const issue = await seedIssue(harness.ds, world.project.id);
    const link = await seedLink(harness.ds, { userId: world.userId, issueId: issue.id, lastSyncedAt: harness.clock.now() });

    await seedMarker(harness.ds, link.id);

    const shown = await post(harness, issuePath(issue.uuid, 'show'), world.cookie).expect(200);

    expect(shown.body.link).toMatchObject({ state: 'pending', states: expect.arrayContaining(['pending']) });
  });

  it('answers 409 ISSUE_LINKED when deleting a linked issue, and succeeds after an unlink', async () => {
    scriptIssue(harness);

    const imported = await api().importIssue().expect(201);
    const id = imported.body.id as string;

    expect((await post(harness, issuePath(id, 'delete'), world.cookie).expect(409)).body.error.code).toBe('ISSUE_LINKED');

    await api().unlink(id).expect(200);
    await post(harness, issuePath(id, 'delete'), world.cookie).expect(200);
    await post(harness, issuePath(id, 'show'), world.cookie).expect(404);
  });

  it('never reaches the intruder\'s project, issue or GitHub issue', async () => {
    const { intruder } = harness;
    const other = { ...world, project: { id: intruder.projectId, uuid: intruder.projectUuid } };

    await linkApi(harness, other).importIssue().expect(404);
    await linkApi(harness, other).attach(intruder.issueUuid).expect(404);
    await linkApi(harness, other).unlink(intruder.issueUuid).expect(404);
    await api().unlink(intruder.issueUuid).expect(404);

    expect(harness.github.githubCalls()).toEqual([]);
    await expect(harness.ds.query('SELECT id FROM issues_github_links WHERE id = ?', [intruder.linkId])).resolves.toHaveLength(1);
    await expect(harness.ds.query('SELECT id FROM issues_pending_writes WHERE id = ?', [intruder.markerId])).resolves.toHaveLength(1);
  });
});
