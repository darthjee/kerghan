import { githubIssue, issue as issueCase } from '../../integrations/tests/support/github-builders.js';
import { IssueMarkers } from '../issue-markers.js';
import { IssuesSyncBootstrap } from '../issues-sync.bootstrap.js';
import { IssuesService } from '../issues.service.js';
import { ISSUES_RECONCILE_JOB, IssuesReconcileJob } from '../jobs/issues-reconcile.job.js';
import { buildIssuesDbHarness, type IssuesDbHarness } from './support/issues-db-harness.js';
import { seedIssue, seedLink, seedMarker, seedProject } from './support/issues-seeds.js';
import { buildSyncWorld, githubCase, readState, scriptGet, SYNC_INTEGRATION, SYNC_NUMBER, type SyncWorld } from './support/sync-fixture.js';

// Triggers T1 and T5 and the registered job, on real MySQL, with `FakeWorkersService` standing in
// for the engine: nothing runs until a spec runs the captured jobs.
describe('Issues sync triggers and job (real MySQL)', () => {
  let harness: IssuesDbHarness;
  let issues: IssuesService;
  let projectUuid: string;
  let issueUuid: string;

  beforeAll(async () => {
    harness = await buildIssuesDbHarness();
    issues = harness.get(IssuesService);
  });

  afterAll(() => harness.close());

  const jobs = () => harness.workers.paramsOf(ISSUES_RECONCILE_JOB);

  async function linkedIssue(): Promise<SyncWorld> {
    const world = await buildSyncWorld(harness);
    const rows: Array<{ pu: string; iu: string }> = await harness.ds.query(
      'SELECT p.uuid AS pu, i.uuid AS iu FROM issues i JOIN issues_projects p ON p.id = i.project_id WHERE i.id = ?',
      [world.issueId],
    );

    projectUuid = rows[0].pu;
    issueUuid = rows[0].iu;

    return world;
  }

  it('registers issues.reconcile on init, with the job class and attributes only', () => {
    expect(harness.workers.registrations).toHaveLength(1);
    expect(harness.workers.registrations[0]).toMatchObject({ name: ISSUES_RECONCILE_JOB, klass: IssuesReconcileJob });
    expect(Object.keys(harness.workers.registrations[0].attributes).sort()).toEqual(['config', 'queue', 'sync']);
  });

  describe('T1: a local edit', () => {
    it('enqueues one reconcile after the commit, with { linkId } only, and the job pushes the edit', async () => {
      const world = await linkedIssue();

      await issues.edit(world.userId, projectUuid, issueUuid, { title: 'Edited' });

      expect(jobs()).toEqual([{ linkId: world.linkId }]);

      scriptGet(harness, SYNC_INTEGRATION, githubCase());
      harness.github.script(SYNC_INTEGRATION, 'updateIssue', SYNC_NUMBER, issueCase(githubIssue({ number: SYNC_NUMBER, title: 'Edited' })));
      await harness.workers.runAll();

      const { link, marker } = await readState(harness, world);

      expect(harness.workers.errors).toEqual([]);
      expect(harness.github.githubCalls().filter((call) => call.operation === 'updateIssue').map((call) => call.changes)).toEqual([{ title: 'Edited' }]);
      expect(link.baseTitle).toBe('Edited');
      expect(marker).toBeNull();
    });

    it('is the real trigger: it enqueues only after the edit committed (the marker is already there)', async () => {
      const world = await linkedIssue();

      harness.workers.enqueue = ((original) => (...args: Parameters<typeof original>) => {
        harness.ds.query('SELECT COUNT(*) AS total FROM issues_pending_writes WHERE link_id = ?', [world.linkId]).then(
          (rows: Array<{ total: string }>) => seen.push(Number(rows[0].total)),
        );
        return original(...args);
      })(harness.workers.enqueue.bind(harness.workers));

      const seen: number[] = [];

      await issues.edit(world.userId, projectUuid, issueUuid, { title: 'Edited' });
      await new Promise((resolve) => setImmediate(resolve));

      expect(seen).toEqual([1]);
    });

    it('a burst of edits leaves one waiting job per link', async () => {
      const world = await linkedIssue();

      for (const title of ['a', 'b', 'c']) await issues.edit(world.userId, projectUuid, issueUuid, { title });

      expect(jobs()).toEqual([{ linkId: world.linkId }]);
    });

    it.each([
      ['an unlinked issue', async () => {
        const world = await buildSyncWorld(harness);
        const project = await seedProject(harness.ds, world.userId);
        const issue = await seedIssue(harness.ds, project.id, { title: 'Local' });

        return { userId: world.userId, project: project.uuid, issue: issue.uuid };
      }],
      ['a gone link', async () => {
        const world = await buildSyncWorld(harness, { status: 'gone', statusReason: 'deleted' });
        const rows: Array<{ pu: string; iu: string }> = await harness.ds.query(
          'SELECT p.uuid AS pu, i.uuid AS iu FROM issues i JOIN issues_projects p ON p.id = i.project_id WHERE i.id = ?',
          [world.issueId],
        );

        return { userId: world.userId, project: rows[0].pu, issue: rows[0].iu };
      }],
    ])('enqueues nothing for an edit of %s', async (_label, build) => {
      const target = await build();

      await issues.edit(target.userId, target.project, target.issue, { title: 'Edited' });

      expect(jobs()).toEqual([]);
    });

    it('enqueues nothing for an edit that changes no value', async () => {
      const world = await linkedIssue();

      await issues.edit(world.userId, projectUuid, issueUuid, { title: 'T' });

      expect(jobs()).toEqual([]);
    });

    it('link creation, unlink and an integration change enqueue nothing', async () => {
      const world = await linkedIssue();

      await harness.ds.query('DELETE FROM issues_github_links WHERE id = ?', [world.linkId]);
      harness.github.setUsable(world.userId, []);

      expect(jobs()).toEqual([]);
    });
  });

  describe('T5: boot', () => {
    it('enqueues one reconcile per marker, oldest marked_at first, with no filtering', async () => {
      const world = await buildSyncWorld(harness);
      const links: number[] = [];

      // Three markers, marked out of order; one belongs to a user that is no longer approved.
      for (const [index, hour] of [[0, 12], [1, 8], [2, 10]]) {
        const issue = await seedIssue(harness.ds, world.projectId, { title: `T${index}` });
        const link = await seedLink(harness.ds, { userId: world.userId, issueId: issue.id });

        await seedMarker(harness.ds, link.id, { markedAt: new Date(Date.UTC(2026, 5, 1, hour)) });
        links.push(link.id);
      }

      await harness.ds.query("UPDATE auth_users SET status = 'pending' WHERE id = ?", [world.userId]);
      await harness.get(IssuesSyncBootstrap).onApplicationBootstrap();

      expect(jobs()).toEqual([{ linkId: links[1] }, { linkId: links[2] }, { linkId: links[0] }]);
    });

    it('enqueues nothing when no marker exists', async () => {
      await buildSyncWorld(harness);
      await harness.get(IssuesSyncBootstrap).onApplicationBootstrap();

      expect(jobs()).toEqual([]);
    });

    it('E16: a restart loses the queue, and the boot sweep re-enqueues the unsent write, which then runs', async () => {
      const world = await buildSyncWorld(harness, { local: { title: 'L' }, marker: {} });

      await harness.get(IssuesSyncBootstrap).onApplicationBootstrap();
      expect(jobs()).toEqual([{ linkId: world.linkId }]);

      scriptGet(harness, SYNC_INTEGRATION, githubCase());
      harness.github.script(SYNC_INTEGRATION, 'updateIssue', SYNC_NUMBER, issueCase(githubIssue({ number: SYNC_NUMBER, title: 'L' })));
      await harness.workers.runAll();

      expect((await readState(harness, world)).marker).toBeNull();
    });
  });

  describe('the job', () => {
    it('every enqueue of the run carries the exact key allowlist { linkId }', async () => {
      const world = await linkedIssue();

      await issues.edit(world.userId, projectUuid, issueUuid, { title: 'Edited' });
      await harness.get(IssuesSyncBootstrap).onApplicationBootstrap();

      expect(harness.workers.enqueued.every((entry) => Object.keys(entry.params).join() === 'linkId')).toBe(true);
      expect(harness.workers.enqueued.every((entry) => typeof entry.params.linkId === 'number')).toBe(true);
    });

    it('a rate-limited job finishes without failing, and the resume timer enqueues the link again', async () => {
      const world = await linkedIssue();

      await issues.edit(world.userId, projectUuid, issueUuid, { title: 'Edited' });
      scriptGet(harness, SYNC_INTEGRATION, { kind: 'rate_limited', resetAt: null });
      await harness.workers.runAll();

      expect(harness.workers.errors).toEqual([]);
      expect(jobs()).toHaveLength(1);

      const ordering = jest.spyOn(harness.get(IssueMarkers), 'markedAtFor');

      harness.scheduler.advance(60_000);
      await ordering.mock.results[0].value;
      await new Promise((resolve) => setImmediate(resolve));

      expect(jobs()).toEqual([{ linkId: world.linkId }, { linkId: world.linkId }]);
    });

    it('a transient failure fails the job with a fixed message', async () => {
      const world = await linkedIssue();

      await issues.edit(world.userId, projectUuid, issueUuid, { title: 'Edited' });
      scriptGet(harness, SYNC_INTEGRATION, { kind: 'unavailable', reason: 'server_error' });
      await harness.workers.runAll();

      expect(harness.workers.errors).toEqual([new Error('issues reconcile transient failure')]);
      expect((await readState(harness, world)).marker).not.toBeNull();
    });
  });
});
