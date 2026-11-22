import {
  forbidden, githubIssue, issue as issueCase, issueGone, issueMoved, issuePage, issueRenamed, notFound, notModified,
  rateLimited, serverError, timeout, unauthorized,
} from '../../integrations/tests/support/github-builders.js';
import { seedUser } from '../../repositories/tests/support/two-user-baseline.js';
import { IssueRateLimitPauses } from '../issue-rate-limit-pauses.js';
import { IssueSyncCommit } from '../issue-sync-commit.js';
import { IssueSyncReader } from '../issue-sync-reader.js';
import { IssuesSyncService, type ReconcileOutcome } from '../issues-sync.service.js';
import { integrationRef } from './support/integration-refs.js';
import { buildIssuesDbHarness, type IssuesDbHarness } from './support/issues-db-harness.js';
import {
  buildSyncWorld, githubCase, readState, scriptGet, SYNC_INTEGRATION, SYNC_NUMBER, SYNC_REPOSITORY, SYNC_REPOSITORY_ID,
  type SyncWorld, type SyncWorldOptions,
} from './support/sync-fixture.js';

const EARLIER = new Date('2026-06-01T11:00:00Z');
const TM = new Date('2026-06-01T12:00:00Z');
const LATER = new Date('2026-06-01T13:00:00Z');
const PUT_AT = new Date('2026-06-01T14:00:00Z');

// The reconcile of `sync.md#reconcile` on real MySQL, with a scripted GitHub.
describe('IssuesSyncService (real MySQL)', () => {
  let harness: IssuesDbHarness;
  let service: IssuesSyncService;

  beforeAll(async () => {
    harness = await buildIssuesDbHarness();
    service = harness.get(IssuesSyncService);
  });

  afterAll(() => harness.close());

  const world = (options: SyncWorldOptions = {}) => buildSyncWorld(harness, options);
  const run = (w: SyncWorld, lastAttempt = false): Promise<ReconcileOutcome> => service.reconcile(w.linkId, { lastAttempt });
  const state = (w: SyncWorld) => readState(harness, w);
  const calls = () => harness.github.githubCalls();
  const puts = () => calls().filter((call) => call.operation === 'updateIssue');
  const scriptPut = (updatedAt = PUT_AT) => harness.github.script(
    SYNC_INTEGRATION, 'updateIssue', SYNC_NUMBER, issueCase(githubIssue({ number: SYNC_NUMBER, updatedAt })),
  );

  describe('the L/B/G table', () => {
    it('does nothing when neither side moved, and records the sync', async () => {
      const w = await world({ etag: 'W/"old"' });

      scriptGet(harness, SYNC_INTEGRATION, githubCase({}, 'W/"g2"'));

      expect(await run(w)).toEqual({ kind: 'done' });

      const { issue, link } = await state(w);

      expect(puts()).toEqual([]);
      expect(issue).toMatchObject({ title: 'T', body: 'B', state: 'open' });
      expect(link).toMatchObject({ baseTitle: 'T', etag: 'W/"g2"', githubUpdatedAt: EARLIER, lastSyncedAt: harness.clock.now(), status: 'linked' });
    });

    it('pulls a GitHub change: the issue and the base take it, and creates no marker (E11)', async () => {
      const w = await world();

      scriptGet(harness, SYNC_INTEGRATION, githubCase({ title: 'G', body: null, state: 'closed', updatedAt: LATER }));

      expect(await run(w)).toEqual({ kind: 'done' });

      const { issue, link, marker } = await state(w);

      expect(issue).toMatchObject({ title: 'G', body: null, state: 'closed' });
      expect(issue.updatedAt).toEqual(harness.clock.now());
      expect(link).toMatchObject({ baseTitle: 'G', baseBody: null, baseState: 'closed', githubUpdatedAt: LATER });
      expect(marker).toBeNull();
      expect(puts()).toEqual([]);
    });

    it('pushes a local change as a diff, then the base takes the pushed values and the etag is cleared', async () => {
      const w = await world({ local: { title: 'L', state: 'closed' }, base: {}, marker: { revision: 3 }, etag: 'W/"old"' });

      scriptGet(harness, SYNC_INTEGRATION, githubCase());
      scriptPut();

      expect(await run(w)).toEqual({ kind: 'done' });

      const { link, marker } = await state(w);

      expect(puts().map((call) => call.changes)).toEqual([{ title: 'L', state: 'closed' }]);
      expect(link).toMatchObject({ baseTitle: 'L', baseState: 'closed', baseBody: 'B', etag: null, githubUpdatedAt: PUT_AT, status: 'linked' });
      expect(marker).toBeNull();
    });

    it('never sends state_reason or an unchanged field', async () => {
      const w = await world({ local: { body: 'new body' }, base: {}, marker: {} });

      scriptGet(harness, SYNC_INTEGRATION, githubCase());
      scriptPut();
      await run(w);

      expect(puts().map((call) => Object.keys(call.changes ?? {}))).toEqual([['body']]);
    });

    it('sends a body emptied locally as NULL', async () => {
      const w = await world({ local: { body: null }, base: {}, marker: {} });

      scriptGet(harness, SYNC_INTEGRATION, githubCase());
      scriptPut();
      await run(w);

      expect(puts().map((call) => call.changes)).toEqual([{ body: null }]);
      expect((await state(w)).link.baseBody).toBeNull();
    });

    it('E8: both sides changed to the same value: no call, the base takes it, the marker clears', async () => {
      const w = await world({ local: { title: 'Same' }, base: {}, marker: {} });

      scriptGet(harness, SYNC_INTEGRATION, githubCase({ title: 'Same' }));

      expect(await run(w)).toEqual({ kind: 'done' });

      const { link, marker } = await state(w);

      expect(puts()).toEqual([]);
      expect(link.baseTitle).toBe('Same');
      expect(marker).toBeNull();
    });

    it.each([
      ['Kerghan newer', EARLIER, 'L'],
      ['a tie', TM, 'L'],
      ['GitHub newer', LATER, 'G'],
    ])('E7, %s: the newest edit wins', async (_label, remoteAt, winner) => {
      const w = await world({ local: { title: 'L' }, base: {}, marker: { updatedAt: TM } });

      scriptGet(harness, SYNC_INTEGRATION, githubCase({ title: 'G', updatedAt: remoteAt }));
      scriptPut();
      await run(w);

      const { issue, link, marker } = await state(w);

      expect(issue.title).toBe(winner);
      expect(link.baseTitle).toBe(winner);
      expect(puts()).toHaveLength(winner === 'L' ? 1 : 0);
      expect(marker).toBeNull();
    });

    it('a 304 means GitHub equals the base: it sends the stored etag, keeps it, and still pushes a marked local change', async () => {
      const w = await world({ local: { title: 'L' }, base: {}, marker: {}, etag: 'W/"stored"' });

      scriptGet(harness, SYNC_INTEGRATION, notModified());
      scriptPut();

      expect(await run(w)).toEqual({ kind: 'done' });
      expect(calls()[0]).toMatchObject({ operation: 'getIssue', etag: 'W/"stored"' });
      expect(puts()).toHaveLength(1);
      expect((await state(w)).link).toMatchObject({ baseTitle: 'L', etag: null, githubUpdatedAt: PUT_AT });
    });

    it('a 304 with no marker changes nothing but the sync time and keeps the stored etag', async () => {
      const w = await world({ etag: 'W/"stored"' });

      scriptGet(harness, SYNC_INTEGRATION, notModified());

      expect(await run(w)).toEqual({ kind: 'done' });
      expect((await state(w)).link).toMatchObject({ etag: 'W/"stored"', githubUpdatedAt: EARLIER, lastSyncedAt: harness.clock.now() });
    });

    it('E11: a push followed by a refresh creates no marker and no further push', async () => {
      const w = await world({ local: { title: 'L' }, base: {}, marker: {} });

      scriptGet(harness, SYNC_INTEGRATION, githubCase());
      scriptPut();
      await run(w);
      scriptGet(harness, SYNC_INTEGRATION, githubCase({ title: 'L', updatedAt: PUT_AT }));
      await run(w);

      expect(puts()).toHaveLength(1);
      expect((await state(w)).marker).toBeNull();
    });
  });

  describe('the commit', () => {
    it('E10: an edit during the job skips every pulled field, keeps the marker and asks to run again', async () => {
      const w = await world({ marker: { revision: 1 } });
      const reader = harness.get(IssueSyncReader);
      const commit = harness.get(IssueSyncCommit);
      const subject = await reader.load(w.linkId);

      // The edit lands after the read: the issue and the marker revision move together.
      await harness.ds.query('UPDATE issues SET title = ? WHERE id = ?', ['edited', w.issueId]);
      await harness.ds.query('UPDATE issues_pending_writes SET revision = 2 WHERE link_id = ?', [w.linkId]);

      const result = await commit.apply(subject!, {
        baseValues: {},
        pulled: { title: 'from GitHub' },
        pushed: false,
        githubUpdatedAt: LATER,
        etag: 'W/"fresh"',
      });
      const { issue, link, marker } = await state(w);

      expect(result).toBe('requeue');
      expect(issue.title).toBe('edited');
      expect(link.baseTitle).toBe('T');
      expect(link.etag).toBeNull();
      expect(marker?.revision).toBe(2);
    });

    it('keeps the push effects when the pulled fields are skipped', async () => {
      const w = await world({ local: { title: 'L' }, base: {}, marker: { revision: 1 } });
      const subject = await harness.get(IssueSyncReader).load(w.linkId);

      await harness.ds.query('UPDATE issues_pending_writes SET revision = 2 WHERE link_id = ?', [w.linkId]);

      const result = await harness.get(IssueSyncCommit).apply(subject!, {
        baseValues: { title: 'L' },
        pulled: { body: 'G' },
        pushed: true,
        githubUpdatedAt: PUT_AT,
        etag: null,
      });
      const { issue, link } = await state(w);

      expect(result).toBe('requeue');
      expect(link).toMatchObject({ baseTitle: 'L', baseBody: 'B', githubUpdatedAt: PUT_AT });
      expect(issue.body).toBe('B');
    });

    it('a marker that appeared during a refresh (none read) skips the pulls and requeues', async () => {
      const w = await world();
      const subject = await harness.get(IssueSyncReader).load(w.linkId);

      await harness.ds.query('INSERT INTO issues_pending_writes (link_id, revision, marked_at, updated_at) VALUES (?, 1, ?, ?)', [w.linkId, TM, TM]);

      const result = await harness.get(IssueSyncCommit).apply(subject!, {
        baseValues: {}, pulled: { title: 'G' }, pushed: false, githubUpdatedAt: LATER, etag: 'W/"x"',
      });

      expect(result).toBe('requeue');
      expect((await state(w)).issue.title).toBe('T');
    });

    it('a marker cleared by another job finishes with no new job', async () => {
      const w = await world({ marker: {} });
      const subject = await harness.get(IssueSyncReader).load(w.linkId);

      await harness.ds.query('DELETE FROM issues_pending_writes WHERE link_id = ?', [w.linkId]);

      expect(await harness.get(IssueSyncCommit).apply(subject!, {
        baseValues: {}, pulled: {}, pushed: false, githubUpdatedAt: LATER, etag: null,
      })).toBe('done');
    });

    it('E1 / E32 / E44: a link unlinked or gone, or a deleted issue, mid-job writes nothing', async () => {
      const w = await world({ marker: {} });
      const subject = await harness.get(IssueSyncReader).load(w.linkId);
      const plan = { baseValues: {}, pulled: { title: 'G' }, pushed: false, githubUpdatedAt: LATER, etag: 'W/"x"' };

      await harness.ds.query("UPDATE issues_github_links SET status = 'gone', status_reason = 'deleted' WHERE id = ?", [w.linkId]);
      expect(await harness.get(IssueSyncCommit).apply(subject!, plan)).toBe('done');
      expect((await state(w)).issue.title).toBe('T');

      await harness.ds.query('DELETE FROM issues_github_links WHERE id = ?', [w.linkId]);
      expect(await harness.get(IssueSyncCommit).apply(subject!, plan)).toBe('done');

      await harness.ds.query('DELETE FROM issues WHERE id = ?', [w.issueId]);
      expect(await harness.get(IssueSyncCommit).apply(subject!, plan)).toBe('done');
    });
  });

  describe('guards', () => {
    it.each([
      ['a link that does not exist', async () => 999_999],
      ['a gone link', async () => (await world({ status: 'gone', statusReason: 'deleted' })).linkId],
      ['a deleted project', async () => {
        const w = await world();

        await harness.ds.query('UPDATE issues_projects SET deleted_at = ?, deleted_token = id WHERE id = ?', [TM, w.projectId]);
        return w.linkId;
      }],
    ])('is a silent no-op for %s: no call', async (_label, linkId) => {
      expect(await service.reconcile(await linkId(), { lastAttempt: false })).toEqual({ kind: 'stopped', reason: 'no_link' });
      expect(calls()).toEqual([]);
    });

    it('uses the project owner, not the link user_id, for approval, candidates and every GitHub call', async () => {
      const w = await world({ local: { title: 'L' }, base: {}, marker: { revision: 3 } });
      const other = await seedUser(harness.ds, 'link-user');

      await harness.ds.query("UPDATE auth_users SET status = 'pending' WHERE id = ?", [other]);
      await harness.ds.query('UPDATE issues_github_links SET user_id = ? WHERE id = ?', [other, w.linkId]);
      scriptGet(harness, SYNC_INTEGRATION, githubCase());
      scriptPut();

      expect(await run(w)).toEqual({ kind: 'done' });
      expect(calls().map((call) => [call.operation, call.userId, call.integrationId])).toEqual([
        ['getIssue', w.userId, SYNC_INTEGRATION],
        ['updateIssue', w.userId, SYNC_INTEGRATION],
      ]);
      expect(harness.github.calls.filter((call) => call.userId !== w.userId)).toEqual([]);
      expect(harness.repositories.calls.filter((call) => call.userId !== w.userId)).toEqual([]);
    });

    it('E24: a user that is not approved stops with no call, the marker kept', async () => {
      const w = await world({ marker: {} });

      await harness.ds.query("UPDATE auth_users SET status = 'pending' WHERE id = ?", [w.userId]);

      expect(await run(w)).toEqual({ kind: 'stopped', reason: 'not_approved' });
      expect(calls()).toEqual([]);
      expect((await state(w)).marker).not.toBeNull();
    });

    it.each([
      ['unavailable', 'unavailable' as const],
      ['dangling', null],
    ])('E26: a %s repository stops with no call, the marker and the link state kept', async (_label, status) => {
      const w = await world({ marker: {}, status: 'sync_failed', statusReason: 'forbidden' });

      if (status === null) harness.repositories.reset();
      else harness.repositories.seed(w.userId, { repositoryId: SYNC_REPOSITORY_ID, ...SYNC_REPOSITORY, status, integrationSourceIds: [SYNC_INTEGRATION] });

      expect(await run(w)).toEqual({ kind: 'stopped', reason: 'repository_unavailable' });
      expect(calls()).toEqual([]);
      expect((await state(w)).marker).not.toBeNull();
      expect((await state(w)).link).toMatchObject({ status: 'sync_failed', statusReason: 'forbidden' });
    });

    it('an Unknown repository is allowed', async () => {
      const w = await world();

      harness.repositories.seed(w.userId, { repositoryId: SYNC_REPOSITORY_ID, ...SYNC_REPOSITORY, status: 'unknown', integrationSourceIds: [SYNC_INTEGRATION] });
      scriptGet(harness, SYNC_INTEGRATION, githubCase());

      expect(await run(w)).toEqual({ kind: 'done' });
    });

    it('E20: no integration lists the repository: sync_failed no_credential, no call, marker kept', async () => {
      const w = await world({ marker: {}, integrations: [] });

      expect(await run(w)).toEqual({ kind: 'stopped', reason: 'credential' });
      expect(calls()).toEqual([]);
      expect((await state(w)).link).toMatchObject({ status: 'sync_failed', statusReason: 'no_credential' });
      expect((await state(w)).marker).not.toBeNull();
    });

    it('the only listing integration is not usable: sync_failed credential_invalid, no call', async () => {
      const w = await world();

      harness.github.setUsable(w.userId, []);
      harness.github.setIntegrations(w.userId, [integrationRef(SYNC_INTEGRATION)]);

      expect(await run(w)).toEqual({ kind: 'stopped', reason: 'credential' });
      expect(calls()).toEqual([]);
      expect((await state(w)).link).toMatchObject({ status: 'sync_failed', statusReason: 'credential_invalid' });
    });

    it('a handle alone is no candidate: it makes no call', async () => {
      const w = await world({ integrations: [] });

      harness.repositories.seed(w.userId, { repositoryId: SYNC_REPOSITORY_ID, ...SYNC_REPOSITORY, integrationSourceIds: [] });
      await run(w);

      expect(calls()).toEqual([]);
    });
  });

  describe('the candidate walk', () => {
    const two = () => world({ integrations: [41, 42] });

    it('falls back to the next candidate on a 401, restarting from the GET, and marks nothing failed', async () => {
      const w = await two();

      scriptGet(harness, 41, unauthorized());
      scriptGet(harness, 42, githubCase({ title: 'G', updatedAt: LATER }));

      expect(await run(w)).toEqual({ kind: 'done' });
      expect(calls().map((call) => [call.operation, call.integrationId])).toEqual([['getIssue', 41], ['getIssue', 42]]);
      expect((await state(w)).link).toMatchObject({ status: 'linked', baseTitle: 'G' });
    });

    it('falls back on a 403 and on an unusable integration', async () => {
      const w = await world({ integrations: [41, 42, 43] });

      scriptGet(harness, 41, forbidden());
      scriptGet(harness, 42, { kind: 'integration_unusable', reason: 'status' });
      scriptGet(harness, 43, githubCase());

      expect(await run(w)).toEqual({ kind: 'done' });
      expect(calls().map((call) => call.integrationId)).toEqual([41, 42, 43]);
    });

    it('falls back from a PATCH 403 too, restarting from the GET of the next candidate', async () => {
      const w = await world({ integrations: [41, 42], local: { title: 'L' }, base: {}, marker: {} });

      scriptGet(harness, 41, githubCase());
      harness.github.script(41, 'updateIssue', SYNC_NUMBER, forbidden());
      scriptGet(harness, 42, githubCase());
      harness.github.script(42, 'updateIssue', SYNC_NUMBER, issueCase(githubIssue({ number: SYNC_NUMBER, updatedAt: PUT_AT })));

      expect(await run(w)).toEqual({ kind: 'done' });
      expect(calls().map((call) => [call.operation, call.integrationId])).toEqual([
        ['getIssue', 41], ['updateIssue', 41], ['getIssue', 42], ['updateIssue', 42],
      ]);
    });

    it('E21: when every candidate fails, the reason is forbidden if any answered 403', async () => {
      const w = await two();

      scriptGet(harness, 41, unauthorized());
      scriptGet(harness, 42, forbidden());

      expect(await run(w)).toEqual({ kind: 'stopped', reason: 'credential' });
      expect((await state(w)).link).toMatchObject({ status: 'sync_failed', statusReason: 'forbidden' });
    });

    it('E19: when every candidate answers 401, the reason is credential_invalid', async () => {
      const w = await two();

      scriptGet(harness, 41, unauthorized());
      scriptGet(harness, 42, unauthorized());

      expect(await run(w)).toEqual({ kind: 'stopped', reason: 'credential' });
      expect((await state(w)).link).toMatchObject({ status: 'sync_failed', statusReason: 'credential_invalid' });
    });

    it('never falls back on a timeout or a 5xx', async () => {
      const w = await two();

      scriptGet(harness, 41, timeout());
      expect(await run(w)).toEqual({ kind: 'transient' });
      scriptGet(harness, 41, serverError());
      expect(await run(w)).toEqual({ kind: 'transient' });
      expect(calls().map((call) => call.integrationId)).toEqual([41, 41]);
    });
  });

  describe('transient failures and exhaustion', () => {
    it('answers transient and writes no state until the last attempt', async () => {
      const w = await world({ marker: {} });

      scriptGet(harness, SYNC_INTEGRATION, serverError());

      expect(await run(w)).toEqual({ kind: 'transient' });
      expect((await state(w)).link.status).toBe('linked');
    });

    it('E18: the last attempt sets sync_failed retries_exhausted and keeps the marker', async () => {
      const w = await world({ marker: {} });

      scriptGet(harness, SYNC_INTEGRATION, serverError());

      expect(await run(w, true)).toEqual({ kind: 'stopped', reason: 'retries_exhausted' });
      expect((await state(w)).link).toMatchObject({ status: 'sync_failed', statusReason: 'retries_exhausted' });
      expect((await state(w)).marker).not.toBeNull();
    });

    it('an unclassifiable 301 is transient, never gone', async () => {
      const w = await world();

      scriptGet(harness, SYNC_INTEGRATION, { kind: 'unavailable', reason: 'redirect' });

      expect(await run(w)).toEqual({ kind: 'transient' });
      expect((await state(w)).link.status).toBe('linked');
    });

    it('the last attempt succeeding sets no failure', async () => {
      const w = await world();

      scriptGet(harness, SYNC_INTEGRATION, githubCase());

      expect(await run(w, true)).toEqual({ kind: 'done' });
    });
  });

  describe('404, 410 and the E22 probe', () => {
    it.each([['404', notFound()], ['410', issueGone()]])('a %s with a passing probe makes the link gone (deleted) and discards the marker', async (_label, answer) => {
      const w = await world({ marker: {} });

      scriptGet(harness, SYNC_INTEGRATION, answer);
      harness.github.script(SYNC_INTEGRATION, 'probeIssues', 0, issuePage([]));

      expect(await run(w)).toEqual({ kind: 'stopped', reason: 'gone' });

      const { link, marker } = await state(w);

      expect(link).toMatchObject({ status: 'gone', statusReason: 'deleted' });
      expect(marker).toBeNull();
      expect(calls().map((call) => call.operation)).toEqual(['getIssue', 'probeIssues']);
    });

    it.each([['403', forbidden()], ['404', notFound()]])('a 404 whose probe fails with %s is access lost: sync_failed forbidden', async (_label, probe) => {
      const w = await world({ marker: {} });

      scriptGet(harness, SYNC_INTEGRATION, notFound());
      harness.github.script(SYNC_INTEGRATION, 'probeIssues', 0, probe);

      expect(await run(w)).toEqual({ kind: 'stopped', reason: 'credential' });
      expect((await state(w)).link).toMatchObject({ status: 'sync_failed', statusReason: 'forbidden' });
      expect((await state(w)).marker).not.toBeNull();
    });

    it('a 404 whose probe fails with 401 is credential_invalid', async () => {
      const w = await world();

      scriptGet(harness, SYNC_INTEGRATION, notFound());
      harness.github.script(SYNC_INTEGRATION, 'probeIssues', 0, unauthorized());

      expect(await run(w)).toEqual({ kind: 'stopped', reason: 'credential' });
      expect((await state(w)).link).toMatchObject({ status: 'sync_failed', statusReason: 'credential_invalid' });
    });

    it('the probe uses the same candidate that got the 404, and does not fall back', async () => {
      const w = await world({ integrations: [41, 42] });

      scriptGet(harness, 41, notFound());
      harness.github.script(41, 'probeIssues', 0, forbidden());

      await run(w);

      expect(calls().map((call) => [call.operation, call.integrationId])).toEqual([['getIssue', 41], ['probeIssues', 41]]);
    });

    it('E2: a transfer makes the link gone (moved)', async () => {
      const w = await world({ marker: {} });

      scriptGet(harness, SYNC_INTEGRATION, issueMoved());

      expect(await run(w)).toEqual({ kind: 'stopped', reason: 'gone' });
      expect((await state(w)).link).toMatchObject({ status: 'gone', statusReason: 'moved' });
      expect((await state(w)).marker).toBeNull();
    });

    it('a PATCH that finds the issue deleted goes through the same probe', async () => {
      const w = await world({ local: { title: 'L' }, base: {}, marker: {} });

      scriptGet(harness, SYNC_INTEGRATION, githubCase());
      harness.github.script(SYNC_INTEGRATION, 'updateIssue', SYNC_NUMBER, notFound());
      harness.github.script(SYNC_INTEGRATION, 'probeIssues', 0, issuePage([]));

      expect(await run(w)).toEqual({ kind: 'stopped', reason: 'gone' });
      expect((await state(w)).link.status).toBe('gone');
    });
  });

  describe('E65: a rename', () => {
    it('is handed to Repositories on a GET, with no state change', async () => {
      const w = await world();
      const renamed = githubIssue({ number: SYNC_NUMBER, title: 'T', body: 'B', updatedAt: EARLIER });

      scriptGet(harness, SYNC_INTEGRATION, issueRenamed({ ...SYNC_REPOSITORY }, SYNC_NUMBER, renamed, { owner: 'darthjee', name: 'kerghan-renamed' }));

      expect(await run(w)).toEqual({ kind: 'done' });
      expect(harness.repositories.calls.filter((call) => call.method === 'applyRename').map((call) => call.args))
        .toEqual([[SYNC_REPOSITORY_ID, { owner: 'darthjee', name: 'kerghan-renamed' }]]);
      expect((await state(w)).link.status).toBe('linked');
    });

    it('is followed by the PATCH, which addresses the new name', async () => {
      const w = await world({ local: { title: 'L' }, base: {}, marker: {} });
      const renamed = githubIssue({ number: SYNC_NUMBER, title: 'T', body: 'B', updatedAt: EARLIER });

      scriptGet(harness, SYNC_INTEGRATION, issueRenamed({ ...SYNC_REPOSITORY }, SYNC_NUMBER, renamed, { owner: 'darthjee', name: 'new-name' }));
      scriptPut();
      await run(w);

      expect(puts()[0].repo).toEqual({ ...SYNC_REPOSITORY, name: 'new-name' });
    });

    it('is handed over from a PATCH answer too', async () => {
      const w = await world({ local: { title: 'L' }, base: {}, marker: {} });
      const updated = githubIssue({ number: SYNC_NUMBER, updatedAt: PUT_AT });

      scriptGet(harness, SYNC_INTEGRATION, githubCase());
      harness.github.script(SYNC_INTEGRATION, 'updateIssue', SYNC_NUMBER, issueRenamed({ ...SYNC_REPOSITORY }, SYNC_NUMBER, updated, { owner: 'o', name: 'n' }));

      expect(await run(w)).toEqual({ kind: 'done' });
      expect(harness.repositories.callsOf('applyRename')).toBe(1);
    });
  });

  describe('rate limits', () => {
    const RESET = () => new Date(harness.clock.now().getTime() + 120_000);

    it('E17: a rate-limited GET pauses the integration, joins the waiting set and keeps the marker and the state', async () => {
      const w = await world({ marker: {} });

      scriptGet(harness, SYNC_INTEGRATION, rateLimited(RESET()));

      const outcome = await run(w);

      expect(outcome).toEqual({ kind: 'rate_limited', until: new Date(Math.floor(RESET().getTime() / 1000) * 1000) });
      expect(harness.get(IssueRateLimitPauses).isPaused(SYNC_INTEGRATION)).toBe(true);
      expect(harness.get(IssueRateLimitPauses).untilFor([w.linkId]).has(w.linkId)).toBe(true);
      expect((await state(w)).link.status).toBe('linked');
      expect((await state(w)).marker).not.toBeNull();
    });

    it('makes no call while paused, and the pause falls back to 60 seconds when GitHub gave no reset', async () => {
      const w = await world();

      scriptGet(harness, SYNC_INTEGRATION, { kind: 'rate_limited', resetAt: null });
      const first = await run(w);

      expect(first).toEqual({ kind: 'rate_limited', until: new Date(harness.clock.now().getTime() + 60_000) });

      const before = calls().length;

      expect(await run(w)).toEqual(first);
      expect(calls()).toHaveLength(before);
    });

    it('enqueues the waiting link again at the reset, then a fresh reconcile may run', async () => {
      const w = await world();

      scriptGet(harness, SYNC_INTEGRATION, { kind: 'rate_limited', resetAt: null });
      await run(w);
      harness.scheduler.advance(60_000);
      scriptGet(harness, SYNC_INTEGRATION, githubCase());

      expect(await run(w)).toEqual({ kind: 'done' });
      expect(harness.get(IssueRateLimitPauses).untilFor([w.linkId]).size).toBe(0);
    });

    it('a rate limit on a PATCH keeps the marker and the base, and pauses', async () => {
      const w = await world({ local: { title: 'L' }, base: {}, marker: {} });

      scriptGet(harness, SYNC_INTEGRATION, githubCase());
      harness.github.script(SYNC_INTEGRATION, 'updateIssue', SYNC_NUMBER, { kind: 'rate_limited', resetAt: null });

      expect((await run(w)).kind).toBe('rate_limited');
      expect((await state(w)).link.baseTitle).toBe('T');
      expect((await state(w)).marker).not.toBeNull();
    });

    it('a pause on one integration leaves another working, and never falls back after a limit', async () => {
      const w = await world({ integrations: [41, 42] });

      harness.get(IssueRateLimitPauses).pause(41, new Date(harness.clock.now().getTime() + 600_000));
      scriptGet(harness, 42, githubCase());

      expect(await run(w)).toEqual({ kind: 'done' });
      expect(calls().map((call) => call.integrationId)).toEqual([42]);
    });

    it('when every candidate is paused the link joins the set of the earliest reset, with no call', async () => {
      const w = await world({ integrations: [41, 42] });
      const now = harness.clock.now().getTime();

      harness.get(IssueRateLimitPauses).pause(41, new Date(now + 900_000));
      harness.get(IssueRateLimitPauses).pause(42, new Date(now + 300_000));

      expect(await run(w)).toEqual({ kind: 'rate_limited', until: new Date(now + 300_000) });
      expect(calls()).toEqual([]);
    });
  });

  describe('sync_failed transitions', () => {
    it('a successful clear of a marker leaves sync_failed', async () => {
      const w = await world({ local: { title: 'L' }, base: {}, marker: {}, status: 'sync_failed', statusReason: 'forbidden' });

      scriptGet(harness, SYNC_INTEGRATION, githubCase());
      scriptPut();
      await run(w);

      expect((await state(w)).link).toMatchObject({ status: 'linked', statusReason: null });
    });

    it('a successful refresh with no marker leaves sync_failed', async () => {
      const w = await world({ status: 'sync_failed', statusReason: 'credential_invalid' });

      scriptGet(harness, SYNC_INTEGRATION, githubCase());
      await run(w);

      expect((await state(w)).link).toMatchObject({ status: 'linked', statusReason: null });
    });

    it('a refresh never clears a failure that belongs to an unsent write', async () => {
      const w = await world({ status: 'sync_failed', statusReason: 'retries_exhausted' });
      const subject = await harness.get(IssueSyncReader).load(w.linkId);

      await harness.ds.query('INSERT INTO issues_pending_writes (link_id, revision, marked_at, updated_at) VALUES (?, 1, ?, ?)', [w.linkId, TM, TM]);
      await harness.get(IssueSyncCommit).apply(subject!, { baseValues: {}, pulled: {}, pushed: false, githubUpdatedAt: LATER, etag: null });

      expect((await state(w)).link).toMatchObject({ status: 'sync_failed', statusReason: 'retries_exhausted' });
    });

    it('sync_failed never blocks a job: every trigger still runs', async () => {
      const w = await world({ status: 'sync_failed', statusReason: 'forbidden' });

      scriptGet(harness, SYNC_INTEGRATION, githubCase());

      expect((await run(w)).kind).toBe('done');
      expect(calls()).toHaveLength(1);
    });

    it('the latest failure reason overwrites an earlier one', async () => {
      const w = await world({ status: 'sync_failed', statusReason: 'retries_exhausted' });

      scriptGet(harness, SYNC_INTEGRATION, unauthorized());
      await run(w);

      expect((await state(w)).link).toMatchObject({ status: 'sync_failed', statusReason: 'credential_invalid' });
    });
  });
});
