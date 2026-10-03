import { randomBytes, randomUUID } from 'node:crypto';
import { inspect } from 'node:util';
import type { LoggerService } from '../../core/logger.service.js';
import type { Integration } from '../entities/integration.entity.js';
import type { IntegrationStoreService } from '../integration-store.service.js';
import { EncryptedSecret, IntegrationsEncryptionService } from '../integrations-encryption.service.js';
import {
  formatKeyStatus,
  formatReencryptSummary,
  IntegrationsKeyRotationService,
  REENCRYPT_BATCH_SIZE,
  reencryptExitCode,
} from '../integrations-key-rotation.service.js';
import { integrationsKeySetOf } from '../integrations-key.js';
import { Secret } from '../secret.js';

const CANARY = 'ghp_CANARYcanaryROTATION0000000000000000';

/**
 * In-memory double of the store's operator-only reads and conditional rewrite.
 */
class FakeRotationStore {
  readonly rows: Integration[] = [];
  readonly batchCalls: Array<[string[], number, number]> = [];
  /** Hook run right before a rewrite, to simulate a concurrent change. */
  beforeRewrite: (row: Integration) => void = () => undefined;

  async countBySecretKeyIdForOperator(): Promise<Array<{ keyId: string; count: number }>> {
    const counts = new Map<string, number>();
    this.rows.forEach((row) => counts.set(row.secretKeyId, (counts.get(row.secretKeyId) ?? 0) + 1));

    return [...counts].map(([keyId, count]) => ({ keyId, count }));
  }

  async findBySecretKeyIdsForOperator(keyIds: string[], afterId: number, limit: number): Promise<Integration[]> {
    this.batchCalls.push([keyIds, afterId, limit]);

    return this.rows
      .filter((row) => keyIds.includes(row.secretKeyId) && row.id > afterId)
      .sort((a, b) => a.id - b.id)
      .slice(0, limit)
      .map((row) => ({ ...row }));
  }

  async rewriteSecret(row: Integration, encrypted: EncryptedSecret, expectedKeyId: string): Promise<boolean> {
    const stored = this.rows.find((candidate) => candidate.id === row.id && candidate.userId === row.userId)!;
    this.beforeRewrite(stored);

    if (stored.secretKeyId !== expectedKeyId) {
      return false;
    }

    Object.assign(stored, {
      secretKeyId: encrypted.keyId,
      secretIv: encrypted.iv,
      secretAuthTag: encrypted.authTag,
      secretCiphertext: encrypted.ciphertext,
    });

    return true;
  }
}

interface Context {
  store: FakeRotationStore;
  service: IntegrationsKeyRotationService;
  current: IntegrationsEncryptionService;
  previous: IntegrationsEncryptionService[];
  logger: { debug: jest.Mock; info: jest.Mock; warn: jest.Mock; error: jest.Mock };
}

/**
 * Builds the service over a current key and two previous keys.
 * @returns {Context} The service and its collaborators.
 */
function build(): Context {
  const currentKey = randomBytes(32);
  const previousKeys = [randomBytes(32), randomBytes(32)];
  const encryption = new IntegrationsEncryptionService(integrationsKeySetOf(currentKey, previousKeys));
  const store = new FakeRotationStore();
  const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const service = new IntegrationsKeyRotationService(
    store as unknown as IntegrationStoreService,
    encryption,
    logger as unknown as LoggerService,
  );

  return {
    store,
    service,
    current: encryption,
    previous: previousKeys.map((key) => new IntegrationsEncryptionService(integrationsKeySetOf(key))),
    logger,
  };
}

/**
 * Seeds a row encrypted by the given service.
 * @param {Context} context - The test context.
 * @param {IntegrationsEncryptionService} under - The service whose current key encrypts the row.
 * @returns {Integration} The stored row.
 */
function seed(context: Context, under: IntegrationsEncryptionService): Integration {
  const uuid = randomUUID();
  const encrypted = under.encrypt(new Secret({ token: CANARY }), { uuid, type: 'pat' });
  const row = {
    id: context.store.rows.length + 1,
    userId: 7,
    uuid,
    type: 'pat',
    secretKeyId: encrypted.keyId,
    secretIv: encrypted.iv,
    secretAuthTag: encrypted.authTag,
    secretCiphertext: encrypted.ciphertext,
  } as Integration;
  context.store.rows.push(row);

  return row;
}

/**
 * Decrypts a stored row with the rotated key set.
 * @param {Context} context - The test context.
 * @param {Integration} row - The stored row.
 * @returns {unknown} The payload, or `undefined` when undecryptable.
 */
function decrypted(context: Context, row: Integration): unknown {
  return context.current.decrypt({
    keyId: row.secretKeyId,
    iv: row.secretIv,
    authTag: row.secretAuthTag,
    ciphertext: row.secretCiphertext,
    uuid: row.uuid,
    type: row.type,
  })?.reveal();
}

describe('IntegrationsKeyRotationService', () => {
  let context: Context;

  beforeEach(() => {
    context = build();
  });

  afterEach(() => {
    const logged = inspect(Object.values(context.logger).map((mock) => mock.mock.calls), { depth: 10 });

    expect(logged).not.toContain(CANARY);
    expect(logged).not.toMatch(/Buffer|<Buffer/);
  });

  describe('status', () => {
    it('lists the current and previous keys with 0 rows on an empty table', async () => {
      expect(await context.service.status()).toEqual([
        { keyId: context.current.currentKeyId, role: 'current', count: 0 },
        { keyId: context.current.previousKeyIds[0], role: 'previous', count: 0 },
        { keyId: context.current.previousKeyIds[1], role: 'previous', count: 0 },
      ]);
    });

    it('labels and orders current, previous (config order) then unknown (id order)', async () => {
      seed(context, context.previous[1]);
      seed(context, context.current);
      seed(context, context.current);
      seed(context, context.previous[1]);
      seed(context, context.previous[1]);
      seed(context, context.current).secretKeyId = 'ffffffff';
      seed(context, context.current).secretKeyId = '00000000';

      expect(await context.service.status()).toEqual([
        { keyId: context.current.currentKeyId, role: 'current', count: 2 },
        { keyId: context.current.previousKeyIds[0], role: 'previous', count: 0 },
        { keyId: context.current.previousKeyIds[1], role: 'previous', count: 3 },
        { keyId: '00000000', role: 'unknown', count: 1 },
        { keyId: 'ffffffff', role: 'unknown', count: 1 },
      ]);
    });
  });

  describe('reencrypt', () => {
    it('moves every previous-key row to the current key, keeping the payload', async () => {
      const rows = [seed(context, context.previous[0]), seed(context, context.previous[1])];
      const untouched = seed(context, context.current);
      const untouchedIv = untouched.secretIv;

      expect(await context.service.reencrypt()).toEqual({ reencrypted: 2, skippedUndecryptable: 0, skippedChanged: 0 });

      for (const row of rows) {
        expect(row.secretKeyId).toBe(context.current.currentKeyId);
        expect(decrypted(context, row)).toEqual({ token: CANARY });
      }

      expect(untouched.secretIv).toBe(untouchedIv);
      expect(context.logger.debug).toHaveBeenCalledWith('integration secret re-encrypted', {
        uuid: rows[0].uuid,
        fromKeyId: context.current.previousKeyIds[0],
        toKeyId: context.current.currentKeyId,
      });
    });

    it('counts and logs (by uuid) an undecryptable row, leaving it untouched', async () => {
      const row = seed(context, context.previous[0]);
      const tampered = Buffer.from(row.secretAuthTag.map((byte) => byte ^ 0xff));
      row.secretAuthTag = tampered;

      expect(await context.service.reencrypt()).toEqual({ reencrypted: 0, skippedUndecryptable: 1, skippedChanged: 0 });
      expect(row.secretKeyId).toBe(context.current.previousKeyIds[0]);
      expect(row.secretAuthTag).toBe(tampered);
      expect(context.logger.warn).toHaveBeenCalledWith('integration secret undecryptable, not re-encrypted', {
        uuid: row.uuid,
        keyId: context.current.previousKeyIds[0],
      });
    });

    it('counts a row whose key id changed concurrently, leaving the concurrent write', async () => {
      const row = seed(context, context.previous[0]);
      context.store.beforeRewrite = (stored): void => {
        stored.secretKeyId = 'abcdef01';
      };

      expect(await context.service.reencrypt()).toEqual({ reencrypted: 0, skippedUndecryptable: 0, skippedChanged: 1 });
      expect(row.secretKeyId).toBe('abcdef01');
      expect(context.logger.warn).toHaveBeenCalledWith('integration secret changed concurrently, not re-encrypted', {
        uuid: row.uuid,
        keyId: context.current.previousKeyIds[0],
      });
    });

    it('ignores rows under an unknown key id', async () => {
      const row = seed(context, context.current);
      row.secretKeyId = 'deadbeef';

      expect(await context.service.reencrypt()).toEqual({ reencrypted: 0, skippedUndecryptable: 0, skippedChanged: 0 });
      expect(row.secretKeyId).toBe('deadbeef');
    });

    it('works across more than one batch, advancing an id cursor', async () => {
      const total = REENCRYPT_BATCH_SIZE * 2 + 5;
      const broken = seed(context, context.previous[0]);
      broken.secretAuthTag = Buffer.from(broken.secretAuthTag.map((byte) => byte ^ 0xff));

      for (let index = 1; index < total; index += 1) {
        seed(context, context.previous[index % 2]);
      }

      expect(await context.service.reencrypt())
        .toEqual({ reencrypted: total - 1, skippedUndecryptable: 1, skippedChanged: 0 });
      expect(context.store.batchCalls.map(([, afterId, limit]) => [afterId, limit])).toEqual([
        [0, REENCRYPT_BATCH_SIZE],
        [REENCRYPT_BATCH_SIZE, REENCRYPT_BATCH_SIZE],
        [REENCRYPT_BATCH_SIZE * 2, REENCRYPT_BATCH_SIZE],
      ]);
      expect(context.store.batchCalls[0][0]).toEqual(context.current.previousKeyIds);
    });

    it('is idempotent: a second run finds nothing to do', async () => {
      seed(context, context.previous[0]);
      seed(context, context.previous[1]);
      await context.service.reencrypt();

      expect(await context.service.reencrypt()).toEqual({ reencrypted: 0, skippedUndecryptable: 0, skippedChanged: 0 });
      expect((await context.service.status()).filter(({ role }) => role === 'previous').map(({ count }) => count))
        .toEqual([0, 0]);
    });
  });
});

describe('formatKeyStatus', () => {
  it('prints one "<keyId> <role> <count>" line per key id', () => {
    expect(formatKeyStatus([
      { keyId: 'aaaaaaaa', role: 'current', count: 3 },
      { keyId: 'bbbbbbbb', role: 'previous', count: 0 },
      { keyId: 'cccccccc', role: 'unknown', count: 1 },
    ])).toBe('aaaaaaaa current 3\nbbbbbbbb previous 0\ncccccccc unknown 1\n');
  });

  it('prints nothing for no lines', () => {
    expect(formatKeyStatus([])).toBe('');
  });
});

describe('formatReencryptSummary', () => {
  it('prints the one-line summary', () => {
    expect(formatReencryptSummary({ reencrypted: 4, skippedUndecryptable: 1, skippedChanged: 2 }))
      .toBe('reencrypted=4 skipped_undecryptable=1 skipped_changed=2\n');
  });
});

describe('reencryptExitCode', () => {
  it.each([
    [{ reencrypted: 3, skippedUndecryptable: 0, skippedChanged: 2 }, 0],
    [{ reencrypted: 0, skippedUndecryptable: 1, skippedChanged: 0 }, 1],
  ])('maps %o to %i', (result, code) => {
    expect(reencryptExitCode(result)).toBe(code);
  });
});
