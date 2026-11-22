import { seedUser } from '../../repositories/tests/support/two-user-baseline.js';
import { IssueLinkPresenter } from '../issue-link-presenter.js';
import { buildIssuesDbHarness, HARNESS_START, type IssuesDbHarness } from './support/issues-db-harness.js';
import { seedIssue, seedLink, seedMarker, seedProject } from './support/issues-seeds.js';

describe('IssueLinkPresenter (real MySQL)', () => {
  let harness: IssuesDbHarness;
  let presenter: IssueLinkPresenter;
  let userId: number;

  beforeAll(async () => {
    harness = await buildIssuesDbHarness();
    presenter = harness.get(IssueLinkPresenter);
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    harness.repositories.reset();
    harness.clock.set(HARNESS_START);
    userId = await seedUser(harness.ds, 'owner');
    harness.repositories.seed(userId, { repositoryId: 1, githubId: 100, owner: 'darthjee', name: 'kerghan' });
  });

  it('presents a page of linked and unlinked issues with a bounded number of queries', async () => {
    const project = await seedProject(harness.ds, userId, { repositoryId: 1 });
    const unlinked = await seedIssue(harness.ds, project.id, { title: 'unlinked' });
    const linked = await Promise.all([1, 2, 3, 4, 5].map(async (number) => {
      const issue = await seedIssue(harness.ds, project.id, { title: `linked ${number}` });
      const link = await seedLink(harness.ds, { userId, issueId: issue.id, githubNumber: number, lastSyncedAt: HARNESS_START });

      return { issue, link };
    }));

    await seedMarker(harness.ds, linked[0].link.id);

    const query = jest.spyOn(harness.ds.manager, 'query');
    const links = await presenter.forIssues([unlinked.id, ...linked.map(({ issue }) => issue.id)]);

    expect(query).toHaveBeenCalledTimes(2);
    expect(harness.repositories.callsOf('projectSummaries')).toBe(1);
    expect(links.has(unlinked.id)).toBe(false);
    expect(links.size).toBe(5);
    expect(links.get(linked[0].issue.id)).toMatchObject({ number: 1, state: 'pending', url: 'https://github.com/darthjee/kerghan/issues/1' });
    expect(links.get(linked[1].issue.id)).toEqual({
      number: 2,
      url: 'https://github.com/darthjee/kerghan/issues/2',
      state: 'linked',
      states: ['linked'],
      reason: null,
      rateLimitedUntil: null,
      lastSyncedAt: HARNESS_START.toISOString(),
      stale: false,
    });
    query.mockRestore();
  });

  it('reads a stale, a gone and a sync_failed link', async () => {
    const project = await seedProject(harness.ds, userId, { repositoryId: 1 });
    const stale = await seedIssue(harness.ds, project.id);
    const gone = await seedIssue(harness.ds, project.id);
    const failed = await seedIssue(harness.ds, project.id);
    const old = new Date(HARNESS_START.getTime() - 2 * 3_600_000);

    await seedLink(harness.ds, { userId, issueId: stale.id, lastSyncedAt: old });
    await seedLink(harness.ds, { userId, issueId: gone.id, status: 'gone', statusReason: 'deleted', lastSyncedAt: old });
    await seedLink(harness.ds, { userId, issueId: failed.id, status: 'sync_failed', statusReason: 'credential_invalid', lastSyncedAt: HARNESS_START });

    const links = await presenter.forIssues([stale.id, gone.id, failed.id]);

    expect(links.get(stale.id)).toMatchObject({ state: 'linked', stale: true });
    expect(links.get(gone.id)).toMatchObject({ state: 'gone', reason: 'deleted', stale: false });
    expect(links.get(failed.id)).toMatchObject({ state: 'sync_failed', reason: 'credential_invalid', stale: false });
  });

  it('reads a link of a project whose repository row is gone as repository_unavailable', async () => {
    const project = await seedProject(harness.ds, userId, { repositoryId: 777 });
    const issue = await seedIssue(harness.ds, project.id);

    await seedLink(harness.ds, { userId, issueId: issue.id, lastSyncedAt: HARNESS_START });

    expect((await presenter.forIssues([issue.id])).get(issue.id)).toMatchObject({ url: null, state: 'repository_unavailable' });
  });
});
