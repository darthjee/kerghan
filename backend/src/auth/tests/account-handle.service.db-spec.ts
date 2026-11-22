import { DataSource } from 'typeorm';
import { openEntityDataSource } from '../../database/tests/db-tier/db-tier.js';
import { AccountHandleService } from '../account-handle.service.js';
import { User } from '../entities/user.entity.js';

async function insertUser(ds: DataSource, username: string, status = 'approved'): Promise<number> {
  const result: { insertId: number } = await ds.query(
    'INSERT INTO auth_users (username, email, password_digest, status) VALUES (?, ?, ?, ?)',
    [username, `${username}@kerghan.test`, 'digest', status],
  );

  return result.insertId;
}

async function deleteIsWaiting(ds: DataSource, settled: () => boolean): Promise<boolean> {
  for (;;) {
    if (settled()) return false;
    const rows: Array<{ id: number }> = await ds.query(
      "SELECT id FROM information_schema.processlist WHERE info LIKE 'DELETE FROM auth_users%'",
    );

    if (rows.length > 0) return true;
  }
}

describe('AccountHandleService (real MySQL)', () => {
  let ds: DataSource;
  let service: AccountHandleService;

  beforeAll(async () => {
    ds = await openEntityDataSource([User]);
    service = new AccountHandleService(ds.getRepository(User));
  });

  afterAll(() => ds.destroy());

  it('returns false for an unknown user and true for an existing one', async () => {
    const id = await insertUser(ds, 'existing');

    await ds.transaction(async (manager) => {
      await expect(service.lockExistingUser(id, manager)).resolves.toBe(true);
      await expect(service.lockExistingUser(id + 1000, manager)).resolves.toBe(false);
    });
  });

  it('isApproved is true only for an approved account', async () => {
    const approved = await insertUser(ds, 'ok-user');
    const pending = await insertUser(ds, 'waiting-user', 'pending');
    const denied = await insertUser(ds, 'refused-user', 'denied');

    await expect(service.isApproved(approved)).resolves.toBe(true);
    await expect(service.isApproved(pending)).resolves.toBe(false);
    await expect(service.isApproved(denied)).resolves.toBe(false);
    await expect(service.isApproved(approved + 100_000)).resolves.toBe(false);
  });

  it('makes a concurrent user delete wait until the locking transaction commits', async () => {
    const id = await insertUser(ds, 'locked');
    const order: string[] = [];
    let deletion: Promise<void> | undefined;
    let deleted = false;

    await ds.transaction(async (manager) => {
      await service.lockExistingUser(id, manager);
      deletion = ds.query('DELETE FROM auth_users WHERE id = ?', [id]).then(() => {
        deleted = true;
        order.push('deleted');
      });

      expect(await deleteIsWaiting(ds, () => deleted)).toBe(true);
      order.push('commit');
    });
    await deletion;

    expect(order).toEqual(['commit', 'deleted']);
    const rows: unknown[] = await ds.query('SELECT id FROM auth_users WHERE id = ?', [id]);
    expect(rows).toHaveLength(0);
  });

  it('lockExistingUserForUpdate answers existence and makes a second exclusive lock wait for the commit', async () => {
    const id = await insertUser(ds, 'exclusive');
    const order: string[] = [];
    let second: Promise<void> | undefined;
    let acquired = false;

    await ds.transaction(async (manager) => {
      await expect(service.lockExistingUserForUpdate(id, manager)).resolves.toBe(true);
      await expect(service.lockExistingUserForUpdate(id + 1000, manager)).resolves.toBe(false);
      second = ds.transaction(async (other) => {
        await service.lockExistingUserForUpdate(id, other);
        acquired = true;
        order.push('second');
      });

      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(acquired).toBe(false);
      order.push('commit');
    });
    await second;

    expect(order).toEqual(['commit', 'second']);
  });
});
