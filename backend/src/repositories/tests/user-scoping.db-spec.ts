import { EventEmitter2 } from '@nestjs/event-emitter';
import { USER_DELETED, UserDeletedEvent } from '../../auth/events/user-deleted.event.js';
import { INTEGRATION_DELETED, IntegrationDeletedEvent } from '../../integrations/integrations-github.public.js';
import { githubRepo, listingPage } from '../../integrations/tests/support/github-builders.js';
import { RepositoriesService } from '../repositories.service.js';
import { reposOf, seedRepo } from './support/repo-rows.js';
import { buildRepositoriesDbHarness, type RepositoriesDbHarness } from './support/repositories-db-harness.js';
import { ref } from './support/sync-harness.js';
import { SHARED_GITHUB_ID, seedTwoUserBaseline, setHandle, snapshotUserRows } from './support/two-user-baseline.js';

const ALL = { page: 1, perPage: 50, filter: 'all' as const, search: '' };

// The sync half of `security.md#required-tests` "User scoping": with the
// two-user baseline, no method, sync, listener or reconciliation reads or
// changes the intruder's rows.
describe('Repositories user scoping (real MySQL)', () => {
  let harness: RepositoriesDbHarness;

  beforeEach(async () => {
    harness = await buildRepositoriesDbHarness();
  });

  afterEach(() => harness.close());

  it('never reads or changes the intruder\'s rows', async () => {
    const { userId, intruderId, intruderIntegrationId } = await seedTwoUserBaseline(harness.ds, { handle: 'owner' });
    const intruderBefore = await snapshotUserRows(harness.ds, intruderId);
    const service = harness.get(RepositoriesService);

    harness.github.setUsable(userId, [ref(1)]);
    harness.github.script(1, 'listRepositories', 1, listingPage(1, [githubRepo({ id: 1, owner: 'octo-org', name: 'mine' })]));
    harness.github.script(1, 'listHandleRepositories', 1, listingPage(1, []));

    // Reads (after the entry-point reconciliation every route runs): the intruder's row
    // (same github_id, same owner/name) is invisible.
    await service.reconcileForRequest(userId);
    expect(await service.findByRef(userId, { githubId: SHARED_GITHUB_ID })).toBeNull();
    expect(await service.findByRef(userId, { fullName: 'octo-org/shared' })).toBeNull();
    expect(await service.markAdded(userId, { githubId: SHARED_GITHUB_ID }, null)).toEqual({ kind: 'gone' });
    expect((await service.list(userId, ALL)).total).toBe(0);
    expect((await service.syncState(userId)).sources.map((source) => source.kind)).toEqual(['integration', 'handle']);

    // A sync, Add, a handle change, both listeners.
    expect(await service.refresh(userId)).toEqual({ kind: 'started' });
    await harness.launcher.runAll();
    await seedRepo(harness.ds, userId, { githubId: SHARED_GITHUB_ID, owner: 'octo-org', name: 'shared', sources: [['integration:1', 1]] });
    expect((await service.markAdded(userId, { fullName: 'octo-org/shared' }, 1)).kind).toBe('added');
    expect((await reposOf(harness.ds, userId)).map((row) => row.github_id)).toEqual(['1', String(SHARED_GITHUB_ID)]);
    await setHandle(harness.ds, userId, 'renamed');
    await service.reconcileForRequest(userId);
    await harness.get(EventEmitter2).emitAsync(INTEGRATION_DELETED, new IntegrationDeletedEvent(userId, intruderIntegrationId));
    await harness.get(EventEmitter2).emitAsync(INTEGRATION_DELETED, new IntegrationDeletedEvent(userId, 1));
    await harness.get(EventEmitter2).emitAsync(USER_DELETED, new UserDeletedEvent(userId));

    expect(await snapshotUserRows(harness.ds, intruderId)).toEqual(intruderBefore);
  });
});
