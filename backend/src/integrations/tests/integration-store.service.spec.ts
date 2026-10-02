import { ConflictException } from '@nestjs/common';
import { Integration } from '../entities/integration.entity.js';
import { ENSURE_LOCKOUT_ROW_SQL } from '../integration-credential-abuse-guard.service.js';
import { IntegrationStoreService, LOCK_OWNER_ROW_SQL } from '../integration-store.service.js';

interface FakeManager {
  query: jest.Mock;
  count: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
}

function build(count: number): { store: IntegrationStoreService; manager: FakeManager; transaction: jest.Mock } {
  const manager: FakeManager = {
    query: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(count),
    create: jest.fn((_entity: unknown, attributes: Partial<Integration>) => ({ ...attributes })),
    save: jest.fn(async (entity: Partial<Integration>) => ({ ...entity, id: 42 })),
  };
  const transaction = jest.fn((work: (inner: FakeManager) => Promise<unknown>) => work(manager));
  const store = new IntegrationStoreService({ manager: { transaction } } as never);

  return { store, manager, transaction };
}

describe('IntegrationStoreService', () => {
  describe('insertWithinCap', () => {
    it('locks the owner row, counts and inserts inside one transaction', async () => {
      const { store, manager, transaction } = build(1);

      const row = await store.insertWithinCap({ userId: 7, label: 'Work' }, 2);

      expect(row).toEqual({ userId: 7, label: 'Work', id: 42 });
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(manager.query).toHaveBeenNthCalledWith(1, ENSURE_LOCKOUT_ROW_SQL, [7]);
      expect(manager.query).toHaveBeenNthCalledWith(2, LOCK_OWNER_ROW_SQL, [7]);
      expect(LOCK_OWNER_ROW_SQL).toMatch(/WHERE `user_id` = \? FOR UPDATE$/);
      expect(manager.query.mock.invocationCallOrder[1]).toBeLessThan(manager.count.mock.invocationCallOrder[0]);
      expect(manager.count).toHaveBeenCalledWith(Integration, { where: { userId: 7 } });
      expect(manager.count.mock.invocationCallOrder[0]).toBeLessThan(manager.save.mock.invocationCallOrder[0]);
      expect(manager.create).toHaveBeenCalledWith(Integration, { userId: 7, label: 'Work' });
    });

    it('answers 409 INTEGRATIONS_LIMIT_REACHED without inserting once the cap is reached', async () => {
      const { store, manager } = build(2);

      const failure = store.insertWithinCap({ userId: 7, label: 'Work' }, 2);

      await expect(failure).rejects.toBeInstanceOf(ConflictException);
      await expect(failure).rejects.toMatchObject({ response: { code: 'INTEGRATIONS_LIMIT_REACHED' } });
      expect(manager.save).not.toHaveBeenCalled();
    });
  });
});
