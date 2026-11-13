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
  describe('setStatusIfCredential', () => {
    it('updates WHERE id, user_id and the secret_iv used, answering whether a row changed', async () => {
      const update = jest.fn().mockResolvedValueOnce({ affected: 1 }).mockResolvedValueOnce({ affected: 0 });
      const store = new IntegrationStoreService({ update } as never);
      const iv = Buffer.from('000102030405060708090a0b', 'hex');

      expect(await store.setStatusIfCredential({ id: 3, userId: 7 }, iv, 'invalid', 'bad_credentials')).toBe(true);
      expect(await store.setStatusIfCredential({ id: 3, userId: 7 }, iv, 'undecryptable', null)).toBe(false);
      expect(update).toHaveBeenNthCalledWith(1, { id: 3, userId: 7, secretIv: iv }, { status: 'invalid', statusReason: 'bad_credentials' });
      expect(update).toHaveBeenNthCalledWith(2, { id: 3, userId: 7, secretIv: iv }, { status: 'undecryptable', statusReason: null });
    });

    it('treats a missing affected count as no change', async () => {
      const store = new IntegrationStoreService({ update: jest.fn().mockResolvedValue({}) } as never);

      expect(await store.setStatusIfCredential({ id: 3, userId: 7 }, Buffer.alloc(12), 'invalid', null)).toBe(false);
    });
  });

  describe('owner-scoped reads by internal id', () => {
    it('findOwnedById and readSecretIv filter by id and user_id', async () => {
      const iv = Buffer.alloc(12, 1);
      const findOne = jest.fn().mockResolvedValueOnce({ id: 3 }).mockResolvedValueOnce({ id: 3, secretIv: iv })
        .mockResolvedValueOnce(null);
      const store = new IntegrationStoreService({ findOne } as never);

      expect(await store.findOwnedById(7, 3)).toEqual({ id: 3 });
      expect(await store.readSecretIv(7, 3)).toBe(iv);
      expect(await store.readSecretIv(7, 4)).toBeNull();
      expect(findOne).toHaveBeenNthCalledWith(1, { where: { id: 3, userId: 7 } });
      expect(findOne).toHaveBeenNthCalledWith(2, { select: { id: true, secretIv: true }, where: { id: 3, userId: 7 } });
    });

    it('listOwnedOldestFirst orders by created_at then id', async () => {
      const find = jest.fn().mockResolvedValue([]);
      const store = new IntegrationStoreService({ find } as never);

      await store.listOwnedOldestFirst(7);

      expect(find).toHaveBeenCalledWith({ where: { userId: 7 }, order: { createdAt: 'ASC', id: 'ASC' } });
    });
  });

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

  describe('rewriteSecret', () => {
    const encrypted = {
      keyId: 'cccccccc',
      iv: Buffer.alloc(12, 1),
      authTag: Buffer.alloc(16, 2),
      ciphertext: Buffer.from([3, 4, 5]),
    };
    const columns = {
      secretKeyId: 'cccccccc',
      secretIv: encrypted.iv,
      secretAuthTag: encrypted.authTag,
      secretCiphertext: encrypted.ciphertext,
    };

    /**
     * Builds the store over a repository whose update affects the given row count.
     * @param {number | undefined} affected - The affected row count.
     * @returns {{ store: IntegrationStoreService; update: jest.Mock }} The store and its update double.
     */
    function buildForUpdate(affected: number | undefined): { store: IntegrationStoreService; update: jest.Mock } {
      const update = jest.fn().mockResolvedValue({ affected });

      return { store: new IntegrationStoreService({ update } as never), update };
    }

    it('updates the four secret columns scoped by id, owner and expected key id', async () => {
      const { store, update } = buildForUpdate(1);
      const row = { id: 3, userId: 7, secretKeyId: 'pppppppp' } as Integration;

      expect(await store.rewriteSecret(row, encrypted, 'pppppppp')).toBe(true);
      expect(update).toHaveBeenCalledWith({ id: 3, userId: 7, secretKeyId: 'pppppppp' }, columns);
      expect(row).toMatchObject(columns);
    });

    it.each([0, undefined])('is a silent no-op when %s rows are affected', async (affected) => {
      const { store } = buildForUpdate(affected);
      const row = { id: 3, userId: 7, secretKeyId: 'pppppppp' } as Integration;

      expect(await store.rewriteSecret(row, encrypted, 'pppppppp')).toBe(false);
      expect(row.secretKeyId).toBe('pppppppp');
    });
  });
});
describe('IntegrationStoreService (operator-only key rotation reads)', () => {
  it('counts every row grouped by secret key id, as numbers', async () => {
    const builder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ keyId: 'aaaaaaaa', count: '3' }, { keyId: 'bbbbbbbb', count: 1 }]),
    };
    const createQueryBuilder = jest.fn().mockReturnValue(builder);
    const store = new IntegrationStoreService({ createQueryBuilder } as never);

    expect(await store.countBySecretKeyIdForOperator()).toEqual([
      { keyId: 'aaaaaaaa', count: 3 },
      { keyId: 'bbbbbbbb', count: 1 },
    ]);
    expect(builder.select).toHaveBeenCalledWith('integration.secret_key_id', 'keyId');
    expect(builder.addSelect).toHaveBeenCalledWith('COUNT(*)', 'count');
    expect(builder.groupBy).toHaveBeenCalledWith('integration.secret_key_id');
  });

  it('reads one id-ordered batch above the cursor, selecting only the rotation columns', async () => {
    const find = jest.fn().mockResolvedValue([]);
    const store = new IntegrationStoreService({ find } as never);

    await store.findBySecretKeyIdsForOperator(['aaaaaaaa', 'bbbbbbbb'], 42, 100);

    const options = find.mock.calls[0][0];
    expect(options.select).toEqual({
      id: true,
      userId: true,
      uuid: true,
      type: true,
      secretKeyId: true,
      secretIv: true,
      secretAuthTag: true,
      secretCiphertext: true,
    });
    expect(options.where.secretKeyId).toMatchObject({ _type: 'in', _value: ['aaaaaaaa', 'bbbbbbbb'] });
    expect(options.where.id).toMatchObject({ _type: 'moreThan', _value: 42 });
    expect(options.where).not.toHaveProperty('userId');
    expect(options).toMatchObject({ order: { id: 'ASC' }, take: 100 });
  });

  it('answers an empty batch without a query when no key id is given', async () => {
    const find = jest.fn();
    const store = new IntegrationStoreService({ find } as never);

    expect(await store.findBySecretKeyIdsForOperator([], 0, 100)).toEqual([]);
    expect(find).not.toHaveBeenCalled();
  });
});
