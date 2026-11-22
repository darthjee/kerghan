import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { USER_DELETED, UserDeletedEvent } from '../../auth/events/user-deleted.event.js';
import { seedUser } from '../../repositories/tests/support/two-user-baseline.js';
import { IssuesEventsListener } from '../issues-events.listener.js';
import { buildIssuesDbHarness, type IssuesDbHarness } from './support/issues-db-harness.js';
import { seedIssue, seedLink, seedMarker, seedProject, type Intruder } from './support/issues-seeds.js';

const TABLES = ['issues_projects', 'issues', 'issues_github_links', 'issues_pending_writes'];

describe('user.deleted listener (real MySQL)', () => {
  let harness: IssuesDbHarness;

  beforeAll(async () => {
    harness = await buildIssuesDbHarness();
  });

  afterAll(() => harness.close());

  async function counts(): Promise<number[]> {
    const result: number[] = [];

    for (const table of TABLES) {
      const rows: Array<{ count: string | number }> = await harness.ds.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
      result.push(Number(rows[0].count));
    }

    return result;
  }

  async function seedOwnerRows(userId: number): Promise<void> {
    const live = await seedProject(harness.ds, userId);
    const deleted = await seedProject(harness.ds, userId, { deleted: true });

    for (const projectId of [live.id, deleted.id]) {
      const issue = await seedIssue(harness.ds, projectId);
      const link = await seedLink(harness.ds, { userId, issueId: issue.id });

      await seedMarker(harness.ds, link.id);
    }
    await seedIssue(harness.ds, live.id);
  }

  async function expectIntruderIntact(intruder: Intruder): Promise<void> {
    expect(await counts()).toEqual([1, 1, 1, 1]);
    await expect(harness.ds.query('SELECT id FROM issues_projects WHERE id = ? AND user_id = ?', [intruder.projectId, intruder.userId]))
      .resolves.toHaveLength(1);
    await expect(harness.ds.query('SELECT id FROM issues_github_links WHERE id = ? AND user_id = ?', [intruder.linkId, intruder.userId]))
      .resolves.toHaveLength(1);
    await expect(harness.ds.query('SELECT id FROM issues WHERE id = ?', [intruder.issueId])).resolves.toHaveLength(1);
    await expect(harness.ds.query('SELECT id FROM issues_pending_writes WHERE id = ?', [intruder.markerId])).resolves.toHaveLength(1);
  }

  it('removes the user\'s markers, links, issues and projects (soft-deleted included), leaving the intruder\'s rows', async () => {
    const userId = await seedUser(harness.ds, 'owner');
    const { intruder } = harness;

    await seedOwnerRows(userId);
    expect(await counts()).toEqual([3, 4, 3, 3]);

    await harness.get(IssuesEventsListener).onUserDeleted(new UserDeletedEvent(userId));

    await expectIntruderIntact(intruder);
  });

  it('is idempotent for a user with no rows', async () => {
    const userId = await seedUser(harness.ds, 'owner');
    const { intruder } = harness;

    await harness.get(IssuesEventsListener).onUserDeleted(new UserDeletedEvent(userId));
    await harness.get(IssuesEventsListener).onUserDeleted(new UserDeletedEvent(userId));

    await expectIntruderIntact(intruder);
  });

  it('is reached by the user.deleted event fired through EventEmitter2', async () => {
    const userId = await seedUser(harness.ds, 'owner');
    const { intruder } = harness;

    await seedOwnerRows(userId);
    await harness.get(EventEmitter2).emitAsync(USER_DELETED, new UserDeletedEvent(userId));

    await expectIntruderIntact(intruder);
  });

  it('logs a failure at error level with safe fields only and does not throw (E53)', async () => {
    const userId = await seedUser(harness.ds, 'owner');
    const { intruder } = harness;
    const spy = jest.spyOn(harness.get(DataSource), 'transaction').mockRejectedValueOnce(new RangeError('boom secret'));

    await seedOwnerRows(userId);
    await expect(harness.get(IssuesEventsListener).onUserDeleted(new UserDeletedEvent(userId))).resolves.toBeUndefined();

    expect(harness.logger.error).toHaveBeenCalledWith('issues user.deleted cleanup failed', {
      context: 'IssuesEventsListener', userId, errorClass: 'RangeError',
    });
    expect(JSON.stringify(harness.logger.error.mock.calls)).not.toContain('boom secret');
    expect(await counts()).toEqual([3, 4, 3, 3]);
    expect(intruder.userId).not.toBe(userId);
    spy.mockRestore();
  });
});
