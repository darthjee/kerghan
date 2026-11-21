import type { DataSource, EntityManager } from 'typeorm';
import type { LoggerService } from '../../core/logger.service.js';
import { IssuesEventsListener } from '../issues-events.listener.js';

function build(transaction: jest.Mock): { listener: IssuesEventsListener; error: jest.Mock } {
  const error = jest.fn();
  const listener = new IssuesEventsListener(
    { transaction } as unknown as DataSource,
    { error } as unknown as LoggerService,
  );

  return { listener, error };
}

describe('IssuesEventsListener.onUserDeleted', () => {
  it('locks projects, issues, links, markers, then deletes children first, all scoped to the user', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const transaction = jest.fn(async (work: (manager: EntityManager) => Promise<void>) => work({ query } as unknown as EntityManager));
    const { listener } = build(transaction);

    await listener.onUserDeleted({ userId: 7 });

    const statements = query.mock.calls.map(([sql]) => String(sql));

    expect(statements.map((sql) => sql.match(/(?:FROM|DELETE FROM) (\w+)/)?.[1])).toEqual([
      'issues_projects', 'issues', 'issues_github_links', 'issues_pending_writes',
      'issues_pending_writes', 'issues_github_links', 'issues', 'issues_projects',
    ]);
    expect(statements.slice(0, 4).every((sql) => sql.endsWith('FOR UPDATE'))).toBe(true);
    expect(statements.slice(4).every((sql) => sql.startsWith('DELETE'))).toBe(true);
    expect(query.mock.calls.every(([, params]) => (params as number[])[0] === 7)).toBe(true);
  });

  it('logs a failure with safe fields only and never rethrows', async () => {
    const transaction = jest.fn().mockRejectedValue(new TypeError('secret detail'));
    const { listener, error } = build(transaction);

    await expect(listener.onUserDeleted({ userId: 7 })).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('issues user.deleted cleanup failed', {
      context: 'IssuesEventsListener',
      userId: 7,
      errorClass: 'TypeError',
    });
  });
});
