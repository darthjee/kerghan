import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { INTEGRATION_DELETED, IntegrationDeletedEvent } from '../../integrations/integrations-github.public.js';
import { RepositoriesEventsListener } from '../repositories-events.listener.js';
import { pagesOf, reposOf, seedPage, seedRepo, seedStatus, sourcesOf, statusesOf } from './support/repo-rows.js';
import { buildRepositoriesDbHarness, type RepositoriesDbHarness } from './support/repositories-db-harness.js';
import { SHARED_GITHUB_ID, seedTwoUserBaseline, snapshotUserRows } from './support/two-user-baseline.js';

const ADDED = new Date('2026-05-02T00:00:00Z');

describe('integration.deleted listener (real MySQL)', () => {
  let harness: RepositoriesDbHarness;

  beforeAll(async () => {
    harness = await buildRepositoriesDbHarness();
  });

  afterAll(() => harness.close());

  it('drops the source, page and status rows, clears the link, prunes not-added repos and keeps added ones; the intruder is untouched', async () => {
    const { userId, intruderId, intruderIntegrationId } = await seedTwoUserBaseline(harness.ds);
    const intruderBefore = await snapshotUserRows(harness.ds, intruderId);
    const key = 'integration:7';

    await seedRepo(harness.ds, userId, { githubId: SHARED_GITHUB_ID, private: true, integrationId: 7, sources: [[key, 1]] });
    await seedRepo(harness.ds, userId, { githubId: 2, private: true, addedAt: ADDED, integrationId: 7, sources: [[key, 1]] });
    await seedRepo(harness.ds, userId, { githubId: 3, integrationId: 8, sources: [[key, 1], ['handle', 1]] });
    await seedRepo(harness.ds, userId, { githubId: 4, sources: [['integration:8', 1]] });
    await seedPage(harness.ds, userId, key, 1);
    await seedPage(harness.ds, userId, 'handle', 1);
    await seedStatus(harness.ds, userId, key, 'ok');
    await seedStatus(harness.ds, userId, 'handle', 'ok');

    await harness.get(EventEmitter2).emitAsync(INTEGRATION_DELETED, new IntegrationDeletedEvent(userId, 7));
    // The user's own event naming the intruder's integration id changes nothing of the intruder.
    await harness.get(EventEmitter2).emitAsync(INTEGRATION_DELETED, new IntegrationDeletedEvent(userId, intruderIntegrationId));

    expect(await sourcesOf(harness.ds, userId)).toEqual(['3|handle|1', '4|integration:8|1']);
    expect(await pagesOf(harness.ds, userId)).toEqual(['handle|1|W/"handle-1"|false']);
    expect(Object.keys(await statusesOf(harness.ds, userId))).toEqual(['handle']);
    expect((await reposOf(harness.ds, userId)).map((row) => [row.github_id, row.integration_id, row.added_at !== null]))
      .toEqual([['2', null, true], ['3', 8, false], ['4', null, false]]);
    expect(await snapshotUserRows(harness.ds, intruderId)).toEqual(intruderBefore);
  });

  it('logs a failure at error level with safe fields and does not throw', async () => {
    const { userId } = await seedTwoUserBaseline(harness.ds);
    const ds = harness.get(DataSource);
    const spy = jest.spyOn(ds, 'transaction').mockRejectedValueOnce(new TypeError('boom secret'));

    await expect(harness.get(RepositoriesEventsListener).onIntegrationDeleted(new IntegrationDeletedEvent(userId, 7)))
      .resolves.toBeUndefined();

    expect(harness.logger.error).toHaveBeenCalledWith('repositories integration.deleted cleanup failed', {
      context: 'RepositoriesEventsListener', userId, integrationId: 7, errorClass: 'TypeError',
    });
    expect(JSON.stringify(harness.logger.error.mock.calls)).not.toContain('boom secret');
    spy.mockRestore();
  });
});
