import { reposOf, seedRepo, seedStatus, sourcesOf } from './support/repo-rows.js';
import {
  buildRepositoriesHttpDbHarness,
  post,
  type RepositoriesHttpDbHarness,
} from './support/repositories-http-db-harness.js';
import { ref } from './support/sync-harness.js';
import { seedTwoUserBaseline, setHandle, SHARED_GITHUB_ID, snapshotUserRows } from './support/two-user-baseline.js';
import { githubRepo, listingPage, notFound, repository } from '../../integrations/tests/support/github-builders.js';
import type { IntegrationRef } from '../../integrations/integrations-github.public.js';
import { HandleReconciler } from '../handle-reconciler.js';

const ROUTES = ['/repositories/mine.json', '/repositories/sync/state.json', '/repositories/sync.json', '/repositories/add.json'];
const HANDLE_ONLY_ID = 3_100_000_001;
const INTEGRATION_ID = 3_100_000_002;

describe('Repositories routes user scoping (real MySQL)', () => {
  let harness: RepositoriesHttpDbHarness;
  let userId: number;
  let intruderId: number;
  let intruderIntegration: IntegrationRef;
  let cookie: string;
  let intruderBefore: Record<string, unknown[]>;

  beforeEach(async () => {
    harness = await buildRepositoriesHttpDbHarness();
    let intruderIntegrationId: number;
    ({ userId, intruderId, intruderIntegrationId } = await seedTwoUserBaseline(harness.ds, { handle: 'oldhandle' }));
    // The intruder added its copy of the shared repo, through its own integration.
    await harness.ds.query('UPDATE repositories SET added_at = ? WHERE user_id = ?', [new Date('2025-12-02T00:00:00Z'), intruderId]);
    intruderBefore = await snapshotUserRows(harness.ds, intruderId);
    intruderIntegration = { id: intruderIntegrationId, uuid: 'intruder-uuid-zz', label: 'intruder-label-zz', type: 'pat' };
    harness.github.setUsable(intruderId, [intruderIntegration]);
    harness.github.setUsable(userId, [ref(5)]);
    cookie = harness.sessionFor(userId);
  });

  afterEach(async () => {
    expect(await snapshotUserRows(harness.ds, intruderId)).toEqual(intruderBefore);
    await harness.close();
  });

  /** A first sync through Refresh: integration 5 sees the shared repo; the handle sees one more. */
  async function syncThroughRefresh(): Promise<void> {
    harness.github.script(5, 'listRepositories', '*', listingPage(1, [githubRepo({ id: SHARED_GITHUB_ID, owner: 'octo-org', name: 'shared' })]));
    harness.github.script(5, 'listHandleRepositories', '*', listingPage(1, [githubRepo({ id: HANDLE_ONLY_ID, owner: 'octo', name: 'handle-only' })]));
    await post(harness, '/repositories/sync.json', cookie).expect(202);
    await harness.launcher.runAll();
  }

  function expectNoIntruderTrace(body: unknown): void {
    const text = JSON.stringify(body);

    expect(text).not.toContain(intruderIntegration.uuid);
    expect(text).not.toContain(intruderIntegration.label);
    expect(text).not.toContain('2025-12-02');
    expect(text).not.toContain('intruder');
  }

  it('never returns or changes the intruder’s rows, through any route or a sync started by one', async () => {
    await syncThroughRefresh();
    harness.github.script(5, 'getRepository', SHARED_GITHUB_ID, repository(githubRepo({ id: SHARED_GITHUB_ID, owner: 'octo-org', name: 'shared' })));

    const listing = await post(harness, '/repositories/mine.json', cookie).expect(200);
    const state = await post(harness, '/repositories/sync/state.json', cookie).expect(200);
    const added = await post(harness, '/repositories/add.json', cookie, { githubId: SHARED_GITHUB_ID }).expect(200);
    const byName = await post(harness, '/repositories/add.json', cookie, { fullName: 'OCTO-ORG/shared' }).expect(200);

    // The owner's own copy: not added before its own Add, linked to its own integration only.
    expect(listing.body.repositories.find((row: { githubId: number }) => row.githubId === SHARED_GITHUB_ID))
      .toMatchObject({ status: 'not_added', addedAt: null, accessIntegration: null, private: false });
    expect(added.body.accessIntegration).toEqual({ uuid: 'uuid-5', label: 'label-5' });
    expect(byName.body.addedAt).toBe(added.body.addedAt);
    [listing, state, added, byName].forEach((response) => expectNoIntruderTrace(response.body));
  });

  it('never resolves the intruder’s integration in sources[] or accessIntegration', async () => {
    await harness.get(HandleReconciler).forRequest(userId);
    await seedRepo(harness.ds, userId, {
      githubId: INTEGRATION_ID,
      addedAt: new Date('2026-05-02T00:00:00Z'),
      integrationId: intruderIntegration.id,
      sources: [[`integration:${intruderIntegration.id}`, 1], ['integration:5', 1]],
    });
    await seedStatus(harness.ds, userId, 'integration:5', 'ok');

    const listing = await post(harness, '/repositories/mine.json', cookie).expect(200);
    const row = listing.body.repositories.find((entry: { githubId: number }) => entry.githubId === INTEGRATION_ID);

    expect(row.accessIntegration).toBeNull();
    expect(row.sources).toEqual([{ kind: 'integration', integration: { uuid: 'uuid-5', label: 'label-5' } }]);
    expectNoIntruderTrace(listing.body);
  });

  describe.each([
    ['changed', 'newhandle'],
    ['cleared', null],
  ])('after the handle was %s', (_label, handle) => {
    beforeEach(async () => {
      await syncThroughRefresh();
      expect(await sourcesOf(harness.ds, userId)).toContain(`${HANDLE_ONLY_ID}|handle|1`);
      await setHandle(harness.ds, userId, handle);
      harness.clock.advance(6 * 60_000); // Past the Refresh cooldown, still inside the TTL.
      harness.github.script(5, 'listHandleRepositories', '*', notFound());
    });

    it.each(ROUTES)('%s, called first, answers without the old handle’s rows', async (route) => {
      const body = route.endsWith('add.json') ? { githubId: HANDLE_ONLY_ID } : {};
      const response = await post(harness, route, cookie, body);

      expect(response.status).toBe(route.endsWith('add.json') ? 404 : route.endsWith('sync.json') ? 202 : 200);
      expect(JSON.stringify(response.body)).not.toContain('oldhandle');
      expect(JSON.stringify(response.body)).not.toContain(String(HANDLE_ONLY_ID));
      expect((await sourcesOf(harness.ds, userId)).filter((entry) => entry.includes('|handle|'))).toEqual([]);
      expect((await reposOf(harness.ds, userId)).map((row) => row.github_id)).not.toContain(String(HANDLE_ONLY_ID));
      expect(harness.github.githubCalls().filter((call) => call.operation === 'getRepository')).toEqual([]);
    });

    it('reports the new handle as pending, normalised', async () => {
      const response = await post(harness, '/repositories/sync/state.json', cookie).expect(200);
      const handles = response.body.sources.filter((source: { kind: string }) => source.kind === 'handle');

      expect(handles).toEqual(handle === null ? [] : [{ kind: 'handle', handle, status: 'pending', syncedAt: null, resetAt: null }]);
    });
  });
});
