import { DataSource } from 'typeorm';
import { openEntityDataSource } from '../../database/tests/db-tier/db-tier.js';
import { AccountHandleService } from '../account-handle.service.js';
import { User } from '../entities/user.entity.js';

async function insertUser(ds: DataSource, username: string): Promise<number> {
  const result: { insertId: number } = await ds.query(
    'INSERT INTO auth_users (username, email, password_digest, status) VALUES (?, ?, ?, ?)',
    [username, `${username}@kerghan.test`, 'digest', 'approved'],
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
});
