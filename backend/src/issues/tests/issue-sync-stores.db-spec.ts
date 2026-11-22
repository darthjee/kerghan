import { seedUser } from '../../repositories/tests/support/two-user-baseline.js';
import { IssueGithubLink } from '../entities/issue-github-link.entity.js';
import { IssuePendingWrite } from '../entities/issue-pending-write.entity.js';
import { IssueLinkStore } from '../issue-link-store.js';
import { IssueMarkers } from '../issue-markers.js';
import { buildIssuesDbHarness, type IssuesDbHarness } from './support/issues-db-harness.js';
import { seedIssue, seedLink, seedMarker, seedProject } from './support/issues-seeds.js';

const T1 = new Date('2026-06-01T10:00:00Z');
const T2 = new Date('2026-06-01T11:00:00Z');
const T3 = new Date('2026-06-01T12:00:00Z');
const NOW = new Date('2026-06-02T08:00:00Z');

// The guarded writes the reconcile commits through (`sync.md#marker-lifecycle`).
describe('Issue sync stores (real MySQL)', () => {
  let harness: IssuesDbHarness;
  let markers: IssueMarkers;
  let links: IssueLinkStore;
  let userId: number;
  let projectId: number;

  beforeAll(async () => {
    harness = await buildIssuesDbHarness();
    markers = harness.get(IssueMarkers);
    links = harness.get(IssueLinkStore);
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    userId = await seedUser(harness.ds, 'owner');
    projectId = (await seedProject(harness.ds, userId)).id;
  });

  async function linked(seed: { status?: string; statusReason?: string | null; lastSyncedAt?: Date | null } = {}, issueTitle = 'T') {
    const issue = await seedIssue(harness.ds, projectId, { title: issueTitle, body: 'B' });
    const link = await seedLink(harness.ds, { userId, issueId: issue.id, ...seed });

    return { issue, link };
  }

  const linkRow = (id: number) => harness.ds.getRepository(IssueGithubLink).findOneByOrFail({ id });
  const markerRows = (linkId: number) => harness.ds.getRepository(IssuePendingWrite).findBy({ linkId });

  describe('IssueMarkers', () => {
    it('lists every marker\'s link oldest marked_at first, ties by marker id, with no filtering', async () => {
      const a = await linked();
      const b = await linked({ status: 'sync_failed', statusReason: 'forbidden' });
      const c = await linked();
      const d = await linked();

      await seedMarker(harness.ds, a.link.id, { markedAt: T3 });
      await seedMarker(harness.ds, b.link.id, { markedAt: T1 });
      await seedMarker(harness.ds, c.link.id, { markedAt: T2 });
      await seedMarker(harness.ds, d.link.id, { markedAt: T2 });

      expect(await markers.listForBoot()).toEqual([b.link.id, c.link.id, d.link.id, a.link.id]);
    });

    it('markedAtFor answers marked_at by link, leaving out a link without a marker', async () => {
      const a = await linked();
      const b = await linked();
      const none = await linked();

      await seedMarker(harness.ds, a.link.id, { markedAt: T2 });
      await seedMarker(harness.ds, b.link.id, { markedAt: T1 });

      expect(await markers.markedAtFor([a.link.id, b.link.id, none.link.id])).toEqual(new Map([[a.link.id, T2], [b.link.id, T1]]));
      expect(await markers.markedAtFor([])).toEqual(new Map());
    });

    it('lists nothing when no marker exists', async () => {
      await linked();

      expect(await markers.listForBoot()).toEqual([]);
    });

    it('reads the revision and timestamps, or null when there is no marker', async () => {
      const { link } = await linked();
      const other = await linked();

      await seedMarker(harness.ds, link.id, { revision: 4, markedAt: T1 });

      expect(await harness.ds.transaction((manager) => markers.findRevision(manager, link.id, { lock: false })))
        .toEqual({ revision: 4, markedAt: T1, updatedAt: T1 });
      expect(await harness.ds.transaction((manager) => markers.findRevision(manager, link.id, { lock: true })))
        .toMatchObject({ revision: 4 });
      expect(await harness.ds.transaction((manager) => markers.findRevision(manager, other.link.id, { lock: true }))).toBeNull();
    });

    it('compare-and-clear deletes the marker only at the revision that was read', async () => {
      const { link } = await linked();

      await seedMarker(harness.ds, link.id, { revision: 3 });

      expect(await harness.ds.transaction((manager) => markers.compareAndClear(manager, link.id, 2))).toBe(false);
      expect(await markerRows(link.id)).toHaveLength(1);
      expect(await harness.ds.transaction((manager) => markers.compareAndClear(manager, link.id, 3))).toBe(true);
      expect(await markerRows(link.id)).toHaveLength(0);
      expect(await harness.ds.transaction((manager) => markers.compareAndClear(manager, link.id, 3))).toBe(false);
    });

    it('compare-and-clear never touches another link\'s marker', async () => {
      const a = await linked();
      const b = await linked();

      await seedMarker(harness.ds, a.link.id, { revision: 1 });
      await seedMarker(harness.ds, b.link.id, { revision: 1 });
      await harness.ds.transaction((manager) => markers.compareAndClear(manager, a.link.id, 1));

      expect(await markerRows(b.link.id)).toHaveLength(1);
    });

    it('deleteForLink drops the marker whatever its revision', async () => {
      const { link } = await linked();

      await seedMarker(harness.ds, link.id, { revision: 9 });

      expect(await harness.ds.transaction((manager) => markers.deleteForLink(manager, link.id))).toBe(true);
      expect(await harness.ds.transaction((manager) => markers.deleteForLink(manager, link.id))).toBe(false);
      expect(await markerRows(link.id)).toHaveLength(0);
    });
  });

  describe('IssueLinkStore', () => {
    it('lockForCommit answers the link, or null when it is gone or missing', async () => {
      const live = await linked();
      const gone = await linked({ status: 'gone', statusReason: 'deleted' });

      expect(await harness.ds.transaction((manager) => links.lockForCommit(manager, live.link.id))).toMatchObject({ id: live.link.id });
      expect(await harness.ds.transaction((manager) => links.lockForCommit(manager, gone.link.id))).toBeNull();
      expect(await harness.ds.transaction((manager) => links.lockForCommit(manager, 999_999))).toBeNull();
    });

    it('recordSync writes the base of the given fields only, the timestamps and the etag', async () => {
      const { link } = await linked();

      expect(await harness.ds.transaction((manager) => links.recordSync(manager, link.id, {
        base: { title: 'New', body: null },
        githubUpdatedAt: T2,
        etag: 'W/"abc"',
        clearFailure: false,
        now: NOW,
      }))).toBe(true);

      expect(await linkRow(link.id)).toMatchObject({
        baseTitle: 'New',
        baseBody: null,
        baseState: 'open',
        githubUpdatedAt: T2,
        etag: 'W/"abc"',
        lastSyncedAt: NOW,
        updatedAt: NOW,
        status: 'linked',
      });
    });

    it('recordSync sets the etag to NULL after a push, and keeps a failure unless asked to clear it', async () => {
      const { link } = await linked({ status: 'sync_failed', statusReason: 'forbidden' });

      await harness.ds.query('UPDATE issues_github_links SET etag = ? WHERE id = ?', ['W/"old"', link.id]);
      await harness.ds.transaction((manager) => links.recordSync(manager, link.id, {
        base: { state: 'closed' }, githubUpdatedAt: T2, etag: null, clearFailure: false, now: NOW,
      }));

      expect(await linkRow(link.id)).toMatchObject({ etag: null, baseState: 'closed', status: 'sync_failed', statusReason: 'forbidden' });

      await harness.ds.transaction((manager) => links.recordSync(manager, link.id, {
        base: {}, githubUpdatedAt: T3, etag: 'W/"new"', clearFailure: true, now: NOW,
      }));

      expect(await linkRow(link.id)).toMatchObject({ status: 'linked', statusReason: null, etag: 'W/"new"', githubUpdatedAt: T3 });
    });

    it('recordSync, markSyncFailed and markLinked leave a gone link alone', async () => {
      const { link } = await linked({ status: 'gone', statusReason: 'moved' });

      expect(await harness.ds.transaction((manager) => links.recordSync(manager, link.id, {
        base: { title: 'X' }, githubUpdatedAt: T2, etag: null, clearFailure: true, now: NOW,
      }))).toBe(false);
      expect(await harness.ds.transaction((manager) => links.markSyncFailed(manager, link.id, 'forbidden', NOW))).toBe(false);
      expect(await harness.ds.transaction((manager) => links.markLinked(manager, link.id, NOW))).toBe(false);

      expect(await linkRow(link.id)).toMatchObject({ status: 'gone', statusReason: 'moved', baseTitle: 'T' });
    });

    it.each(['retries_exhausted', 'no_credential', 'credential_invalid', 'forbidden'] as const)(
      'markSyncFailed sets %s, the latest reason overwriting the earlier one',
      async (reason) => {
        const { link } = await linked({ status: 'sync_failed', statusReason: 'credential_invalid' });

        expect(await harness.ds.transaction((manager) => links.markSyncFailed(manager, link.id, reason, NOW))).toBe(true);
        expect(await linkRow(link.id)).toMatchObject({ status: 'sync_failed', statusReason: reason, updatedAt: NOW });
      },
    );

    it('markLinked resets the status and reason at once', async () => {
      const { link } = await linked({ status: 'sync_failed', statusReason: 'no_credential' });

      expect(await harness.ds.transaction((manager) => links.markLinked(manager, link.id, NOW))).toBe(true);
      expect(await linkRow(link.id)).toMatchObject({ status: 'linked', statusReason: null });
    });

    it.each(['deleted', 'moved'] as const)('markGone sets %s and discards the marker in the same transaction', async (reason) => {
      const { link } = await linked();
      const other = await linked();

      await seedMarker(harness.ds, link.id, { revision: 5 });
      await seedMarker(harness.ds, other.link.id);

      expect(await harness.ds.transaction((manager) => links.markGone(manager, link.id, reason, NOW))).toBe(true);
      expect(await linkRow(link.id)).toMatchObject({ status: 'gone', statusReason: reason, updatedAt: NOW });
      expect(await markerRows(link.id)).toHaveLength(0);
      expect(await markerRows(other.link.id)).toHaveLength(1);
    });

    it('markGone on a gone or missing link does nothing', async () => {
      const { link } = await linked({ status: 'gone', statusReason: 'deleted' });

      await seedMarker(harness.ds, link.id);

      expect(await harness.ds.transaction((manager) => links.markGone(manager, link.id, 'moved', NOW))).toBe(false);
      expect(await harness.ds.transaction((manager) => links.markGone(manager, 999_999, 'moved', NOW))).toBe(false);
      expect(await linkRow(link.id)).toMatchObject({ statusReason: 'deleted' });
    });

    it('markGone rolls back with its transaction', async () => {
      const { link } = await linked();

      await seedMarker(harness.ds, link.id);
      await harness.ds.transaction(async (manager) => {
        await links.markGone(manager, link.id, 'deleted', NOW);
        throw new Error('rollback');
      }).catch(() => undefined);

      expect(await linkRow(link.id)).toMatchObject({ status: 'linked' });
      expect(await markerRows(link.id)).toHaveLength(1);
    });

    it('lists a project\'s non-gone links oldest last_synced_at first, never-synced first, with the marker flag', async () => {
      const newest = await linked({ lastSyncedAt: T3 });
      const never = await linked({ lastSyncedAt: null });
      const oldest = await linked({ status: 'sync_failed', statusReason: 'forbidden', lastSyncedAt: T1 });
      const middle = await linked({ lastSyncedAt: T2 });

      await linked({ status: 'gone', statusReason: 'deleted', lastSyncedAt: T1 });
      await seedMarker(harness.ds, middle.link.id);

      const otherProject = await seedProject(harness.ds, userId);
      const foreignIssue = await seedIssue(harness.ds, otherProject.id);

      await seedLink(harness.ds, { userId, issueId: foreignIssue.id, lastSyncedAt: T1 });

      const rows = await links.listSyncableByProject(harness.ds.manager, projectId);

      expect(rows).toEqual([
        { linkId: never.link.id, lastSyncedAt: null, hasMarker: false },
        { linkId: oldest.link.id, lastSyncedAt: T1, hasMarker: false },
        { linkId: middle.link.id, lastSyncedAt: T2, hasMarker: true },
        { linkId: newest.link.id, lastSyncedAt: T3, hasMarker: false },
      ]);
    });

    it('lists nothing for a project without links', async () => {
      expect(await links.listSyncableByProject(harness.ds.manager, projectId)).toEqual([]);
    });
  });
});
