import { IssueGithubLink } from '../entities/issue-github-link.entity.js';
import { ISSUES_RECONCILE_JOB } from '../jobs/issues-reconcile.job.js';
import { expectNeverCached } from './support/build-issues-test-app.js';
import { buildIssuesHttpDbHarness, type IssuesHttpDbHarness } from './support/issues-http-db-harness.js';
import { seedIssue, seedLink, seedMarker, seedProject } from './support/issues-seeds.js';
import { addLinkUser, buildLinkWorld, linkApi, linkRepository, type LinkWorld } from './support/link-fixture.js';

// T2, T3 and T4 (`api/github-link.md#trigger-routes`): they reset a failure and enqueue, and never
// call GitHub themselves. `FakeWorkersService` captures the jobs.
describe('Sync trigger routes (real MySQL)', () => {
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
  const jobs = () => harness.workers.paramsOf(ISSUES_RECONCILE_JOB);
  const agoMs = (ms: number) => new Date(Math.floor((harness.clock.now().getTime() - ms) / 1000) * 1000);
  const linkRow = (id: number) => harness.ds.getRepository(IssueGithubLink).findOneByOrFail({ id });

  async function linked(options: { status?: string; statusReason?: string | null; syncedMsAgo?: number | null; marker?: boolean; title?: string } = {}) {
    const issue = await seedIssue(harness.ds, world.project.id, { title: options.title ?? 'Local' });
    const link = await seedLink(harness.ds, {
      userId: world.userId,
      issueId: issue.id,
      status: options.status,
      statusReason: options.statusReason,
      lastSyncedAt: options.syncedMsAgo === null ? null : agoMs(options.syncedMsAgo ?? 600_000),
    });

    if (options.marker) await seedMarker(harness.ds, link.id);

    return { issue, link };
  }

  describe('T2 refresh.json', () => {
    it('enqueues one reconcile and answers 202 { issue, alreadyFresh: false } for a stale link', async () => {
      const { issue, link } = await linked({ syncedMsAgo: 61_000 });
      const response = await api().refresh(issue.uuid).expect(202);

      expectNeverCached(response);
      expect(response.body).toMatchObject({ alreadyFresh: false, issue: { id: issue.uuid, link: { state: 'linked' } } });
      expect(jobs()).toEqual([{ linkId: link.id }]);
      expect(harness.github.githubCalls()).toEqual([]);
    });

    it('skips a link with no marker synced under 60 seconds ago: 200 { issue, alreadyFresh: true }, nothing enqueued', async () => {
      const { issue } = await linked({ syncedMsAgo: 30_000 });
      const response = await api().refresh(issue.uuid).expect(200);

      expect(response.body).toMatchObject({ alreadyFresh: true, issue: { id: issue.uuid } });
      expect(jobs()).toEqual([]);
    });

    it('never skips a link with a marker, however fresh', async () => {
      const { issue, link } = await linked({ syncedMsAgo: 1_000, marker: true });
      const response = await api().refresh(issue.uuid).expect(202);

      expect(response.body.alreadyFresh).toBe(false);
      expect(response.body.issue.link.states).toContain('pending');
      expect(jobs()).toEqual([{ linkId: link.id }]);
    });

    it('enqueues a link synced exactly 60 seconds ago, and one that was never synced', async () => {
      const exact = await linked({ syncedMsAgo: 60_000 });
      const never = await linked({ syncedMsAgo: null });

      await api().refresh(exact.issue.uuid).expect(202);
      await api().refresh(never.issue.uuid).expect(202);

      expect(jobs()).toEqual([{ linkId: exact.link.id }, { linkId: never.link.id }]);
    });

    it('enqueues a sync_failed link like any other, without resetting it', async () => {
      const { issue, link } = await linked({ status: 'sync_failed', statusReason: 'forbidden', syncedMsAgo: 120_000 });

      await api().refresh(issue.uuid).expect(202);

      expect(jobs()).toEqual([{ linkId: link.id }]);
      expect(await linkRow(link.id)).toMatchObject({ status: 'sync_failed', statusReason: 'forbidden' });
    });

    it('a second refresh while the job is queued is deduplicated', async () => {
      const { issue } = await linked();

      await api().refresh(issue.uuid).expect(202);
      await api().refresh(issue.uuid).expect(202);

      expect(jobs()).toHaveLength(1);
    });

    it('refuses an unlinked issue with 409 ISSUE_NOT_LINKED, with no job and no GitHub call', async () => {
      const issue = await seedIssue(harness.ds, world.project.id);
      const response = await api().refresh(issue.uuid).expect(409);

      expect(response.body.error.code).toBe('ISSUE_NOT_LINKED');
      expect(jobs()).toEqual([]);
      expect(harness.github.githubCalls()).toEqual([]);
    });

    it('refuses a gone link with 409 ISSUE_LINK_GONE', async () => {
      const { issue } = await linked({ status: 'gone', statusReason: 'deleted' });
      const response = await api().refresh(issue.uuid).expect(409);

      expect(response.body.error.code).toBe('ISSUE_LINK_GONE');
      expect(jobs()).toEqual([]);
    });

    it.each([
      ['unavailable', () => linkRepository(harness, world.userId, 'unavailable')],
      ['dangling', () => harness.repositories.reset()],
    ])('refuses a link whose repository is %s with 409 PROJECT_REPOSITORY_UNAVAILABLE', async (_label, arrange) => {
      const { issue } = await linked({ syncedMsAgo: 120_000 });

      arrange();

      const response = await api().refresh(issue.uuid).expect(409);

      expect(response.body.error.code).toBe('PROJECT_REPOSITORY_UNAVAILABLE');
      expect(jobs()).toEqual([]);
    });

    it('allows an Unknown repository', async () => {
      const { issue } = await linked({ syncedMsAgo: 120_000 });

      linkRepository(harness, world.userId, 'unknown');
      await api().refresh(issue.uuid).expect(202);
    });

    it('answers 404 for another user\'s project and issue, with the same body as a missing one', async () => {
      const { issue } = await linked();
      const other = await addLinkUser(harness, 'other');
      const foreign = await linkApi(harness, other).refresh(issue.uuid).expect(404);
      const missing = await api().refresh('3f2a0000-0000-4000-8000-0000000000aa').expect(404);

      expect(foreign.body.error).toEqual(missing.body.error);
      expect(jobs()).toEqual([]);
    });
  });

  describe('T3 refresh.json of a project', () => {
    it('enqueues one reconcile per non-gone link, oldest last_synced_at first, never-synced first', async () => {
      const newest = await linked({ syncedMsAgo: 120_000 });
      const oldest = await linked({ syncedMsAgo: 900_000 });
      const never = await linked({ syncedMsAgo: null });
      const middle = await linked({ syncedMsAgo: 300_000, status: 'sync_failed', statusReason: 'forbidden' });

      await linked({ status: 'gone', statusReason: 'deleted', syncedMsAgo: 1_000_000 });

      const response = await api().refreshProject().expect(202);

      expectNeverCached(response);
      expect(response.body).toEqual({ enqueued: 4, skippedFresh: 0 });
      expect(jobs().map((params) => params.linkId)).toEqual([never.link.id, oldest.link.id, middle.link.id, newest.link.id]);
      expect(harness.github.githubCalls()).toEqual([]);
    });

    it('skips the fresh links that have no marker, and counts them', async () => {
      const fresh = await linked({ syncedMsAgo: 10_000 });
      const freshWithMarker = await linked({ syncedMsAgo: 10_000, marker: true });
      const stale = await linked({ syncedMsAgo: 600_000 });

      const response = await api().refreshProject().expect(202);

      expect(response.body).toEqual({ enqueued: 2, skippedFresh: 1 });
      expect(jobs().map((params) => params.linkId)).toEqual([stale.link.id, freshWithMarker.link.id]);
      expect(jobs().map((params) => params.linkId)).not.toContain(fresh.link.id);
    });

    it('answers 202 with zeros for a project with no links', async () => {
      expect((await api().refreshProject().expect(202)).body).toEqual({ enqueued: 0, skippedFresh: 0 });
      expect(jobs()).toEqual([]);
    });

    it('only reads the project\'s own links', async () => {
      await linked({ syncedMsAgo: 600_000 });

      const other = await seedProject(harness.ds, world.userId, { repositoryId: null, name: 'other' });
      const foreignIssue = await seedIssue(harness.ds, other.id);

      await seedLink(harness.ds, { userId: world.userId, issueId: foreignIssue.id, lastSyncedAt: agoMs(600_000) });

      expect((await api().refreshProject().expect(202)).body.enqueued).toBe(1);
    });

    it('refuses a project with no repository with 409 PROJECT_HAS_NO_REPOSITORY', async () => {
      const bare = await seedProject(harness.ds, world.userId, { repositoryId: null, name: 'bare' });
      const response = await linkApi(harness, { ...world, project: bare }).refreshProject().expect(409);

      expect(response.body.error.code).toBe('PROJECT_HAS_NO_REPOSITORY');
    });

    it.each([
      ['unavailable', () => linkRepository(harness, world.userId, 'unavailable')],
      ['dangling', () => harness.repositories.reset()],
    ])('refuses a project whose repository is %s with 409 PROJECT_REPOSITORY_UNAVAILABLE', async (_label, arrange) => {
      await linked({ syncedMsAgo: 600_000 });
      arrange();

      expect((await api().refreshProject().expect(409)).body.error.code).toBe('PROJECT_REPOSITORY_UNAVAILABLE');
      expect(jobs()).toEqual([]);
    });

    it('answers 404 for another user\'s project', async () => {
      const other = await addLinkUser(harness, 'other');

      await linkApi(harness, { ...other, project: world.project }).refreshProject().expect(404);
      expect(jobs()).toEqual([]);
    });
  });

  describe('T4 retry-sync.json', () => {
    it('resets a sync_failed link to linked with no reason at once, enqueues it and answers 202 { issue }', async () => {
      const { issue, link } = await linked({ status: 'sync_failed', statusReason: 'retries_exhausted' });
      const response = await api().retrySync(issue.uuid).expect(202);

      expectNeverCached(response);
      expect(response.body.issue).toMatchObject({ id: issue.uuid, link: { state: 'linked', reason: null } });
      expect(await linkRow(link.id)).toMatchObject({ status: 'linked', statusReason: null });
      expect(jobs()).toEqual([{ linkId: link.id }]);
      expect(harness.github.githubCalls()).toEqual([]);
    });

    it('reads as pending when the link has an unsent marker', async () => {
      const { issue } = await linked({ status: 'sync_failed', statusReason: 'forbidden', marker: true });

      expect((await api().retrySync(issue.uuid).expect(202)).body.issue.link.states).toEqual(['pending']);
    });

    it('is a no-op 200 for a linked link: nothing is reset or enqueued', async () => {
      const { issue, link } = await linked();
      const response = await api().retrySync(issue.uuid).expect(200);

      expect(response.body.issue.id).toBe(issue.uuid);
      expect(jobs()).toEqual([]);
      expect(await linkRow(link.id)).toMatchObject({ status: 'linked' });
    });

    it('a double click enqueues once', async () => {
      const { issue } = await linked({ status: 'sync_failed', statusReason: 'forbidden' });

      await api().retrySync(issue.uuid).expect(202);
      await api().retrySync(issue.uuid).expect(200);

      expect(jobs()).toHaveLength(1);
    });

    it.each([
      ['unavailable', () => linkRepository(harness, world.userId, 'unavailable')],
      ['dangling', () => harness.repositories.reset()],
    ])('is refused while the repository is %s, and keeps the failure reason', async (_label, arrange) => {
      const { issue, link } = await linked({ status: 'sync_failed', statusReason: 'credential_invalid' });

      arrange();

      expect((await api().retrySync(issue.uuid).expect(409)).body.error.code).toBe('PROJECT_REPOSITORY_UNAVAILABLE');
      expect(await linkRow(link.id)).toMatchObject({ status: 'sync_failed', statusReason: 'credential_invalid' });
      expect(jobs()).toEqual([]);
    });

    it('refuses an unlinked issue with ISSUE_NOT_LINKED and a gone link with ISSUE_LINK_GONE', async () => {
      const bare = await seedIssue(harness.ds, world.project.id);
      const gone = await linked({ status: 'gone', statusReason: 'moved' });

      expect((await api().retrySync(bare.uuid).expect(409)).body.error.code).toBe('ISSUE_NOT_LINKED');
      expect((await api().retrySync(gone.issue.uuid).expect(409)).body.error.code).toBe('ISSUE_LINK_GONE');
      expect(await linkRow(gone.link.id)).toMatchObject({ status: 'gone', statusReason: 'moved' });
      expect(jobs()).toEqual([]);
    });

    it('answers 404 for another user\'s project', async () => {
      const { issue } = await linked({ status: 'sync_failed', statusReason: 'forbidden' });
      const other = await addLinkUser(harness, 'other');

      await linkApi(harness, { ...other, project: world.project }).retrySync(issue.uuid).expect(404);
      expect(jobs()).toEqual([]);
    });
  });
});
