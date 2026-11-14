import { randomBytes, randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { User } from '../../auth/entities/user.entity.js';
import { openEntityDataSource } from '../../database/tests/db-tier/db-tier.js';
import { Integration } from '../entities/integration.entity.js';
import { IntegrationStoreService } from '../integration-store.service.js';

const KEY_ID = 'k0000001';

async function seedRow(ds: DataSource): Promise<Integration> {
  const user: { insertId: number } = await ds.query(
    'INSERT INTO auth_users (username, email, password_digest, status) VALUES (?, ?, ?, ?)',
    ['owner', 'owner@kerghan.test', 'digest', 'approved'],
  );
  const row: { insertId: number } = await ds.query(
    'INSERT INTO integrations (uuid, user_id, provider, type, label, label_normalized, status, github_login, metadata, '
    + 'secret_key_id, secret_iv, secret_auth_tag, secret_ciphertext) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [randomUUID(), user.insertId, 'github', 'pat', 'work', 'work', 'active', 'octocat', '{}', KEY_ID,
      randomBytes(12), randomBytes(16), randomBytes(32)],
  );

  return ds.getRepository(Integration).findOneByOrFail({ id: row.insertId });
}

// `docs/agents/modules/integrations/github-service.md#required-tests` "Status compare-and-set" (moved from #461):
// a `401` answered for the old credential never marks a replaced one invalid.
describe('IntegrationStoreService status compare-and-set (real MySQL)', () => {
  let ds: DataSource;
  let store: IntegrationStoreService;

  beforeAll(async () => {
    ds = await openEntityDataSource([Integration, User]);
    store = new IntegrationStoreService(ds.getRepository(Integration));
  });

  afterAll(() => ds.destroy());

  const statusOf = async (id: number): Promise<string> => (await ds.getRepository(Integration).findOneByOrFail({ id })).status;

  it('updates the status while secret_iv still equals the iv used', async () => {
    const row = await seedRow(ds);

    expect(await store.setStatusIfCredential(row, row.secretIv, 'invalid', 'github_401')).toBe(true);
    expect(await statusOf(row.id)).toBe('invalid');
  });

  it('affects no row once a Replace rewrote the secret in between; the integration stays active', async () => {
    const row = await seedRow(ds);
    const ivUsed = Buffer.from(row.secretIv);
    const replaced = { ...row };

    expect(await store.rewriteSecret(replaced, { keyId: KEY_ID, iv: randomBytes(12), authTag: randomBytes(16), ciphertext: randomBytes(32) }, KEY_ID))
      .toBe(true);
    expect(await store.setStatusIfCredential(row, ivUsed, 'invalid', 'github_401')).toBe(false);
    expect(await statusOf(row.id)).toBe('active');
  });
});
