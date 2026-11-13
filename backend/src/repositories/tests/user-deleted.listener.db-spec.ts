import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { USER_DELETED, UserDeletedEvent } from '../../auth/events/user-deleted.event.js';
import { RepositoriesEventsListener } from '../repositories-events.listener.js';
import { seedPage, seedRepo, seedStatus, seedSyncState } from './support/repo-rows.js';
import { buildRepositoriesDbHarness, type RepositoriesDbHarness } from './support/repositories-db-harness.js';
import { countUserRows, seedTwoUserBaseline, snapshotUserRows } from './support/two-user-baseline.js';

describe('user.deleted listener (real MySQL)', () => {
  let harness: RepositoriesDbHarness;

  beforeAll(async () => {
    harness = await buildRepositoriesDbHarness();
  });

  afterAll(() => harness.close());

  it('empties the five tables for that user only', async () => {
    const { userId, intruderId } = await seedTwoUserBaseline(harness.ds);
    const intruderBefore = await snapshotUserRows(harness.ds, intruderId);

    await seedRepo(harness.ds, userId, { githubId: 1, addedAt: new Date('2026-05-02T00:00:00Z'), sources: [['handle', 1]] });
    await seedPage(harness.ds, userId, 'handle', 1);
    await seedStatus(harness.ds, userId, 'handle', 'ok');
    await seedSyncState(harness.ds, userId);

    await harness.get(EventEmitter2).emitAsync(USER_DELETED, new UserDeletedEvent(userId));

    expect(Object.values(await countUserRows(harness.ds, userId))).toEqual([0, 0, 0, 0, 0]);
    expect(await snapshotUserRows(harness.ds, intruderId)).toEqual(intruderBefore);
  });

  it('logs a failure at error level with safe fields and does not throw', async () => {
    const { userId } = await seedTwoUserBaseline(harness.ds);
    const ds = harness.get(DataSource);
    const spy = jest.spyOn(ds, 'transaction').mockRejectedValueOnce(new RangeError('boom secret'));

    await expect(harness.get(RepositoriesEventsListener).onUserDeleted(new UserDeletedEvent(userId))).resolves.toBeUndefined();

    expect(harness.logger.error).toHaveBeenCalledWith('repositories user.deleted cleanup failed', {
      context: 'RepositoriesEventsListener', userId, errorClass: 'RangeError',
    });
    expect(JSON.stringify(harness.logger.error.mock.calls)).not.toContain('boom secret');
    spy.mockRestore();
  });
});
