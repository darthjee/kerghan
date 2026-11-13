import { Test, type TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module.js';
import { pagesOf, reposOf, seedPage, seedRepo, seedStatus, sourcesOf, statusesOf } from './support/repo-rows.js';
import { seedIntegration, seedTwoUserBaseline, snapshotUserRows } from './support/two-user-baseline.js';
import { INTEGRATIONS_KEY_DEV_PLACEHOLDER } from '../../integrations/integrations-key.js';
import { IntegrationsService } from '../../integrations/integrations.service.js';

// Boots the real `AppModule` wiring on the DB tier: the Repositories
// listener must be registered at boot, so deleting an integration through
// the real `IntegrationsService` runs the cleanup even though no
// Repositories request ever ran (`integrations.md#required-tests`, moved to #463).
describe('integration.deleted cleanup at boot (real AppModule, real MySQL)', () => {
  let module: TestingModule;

  beforeAll(async () => {
    process.env.KERGHAN_SECRET_KEY ??= 'db-tier-secret-key-for-app-module-boot';
    process.env.KERGHAN_INTEGRATIONS_KEY ??= INTEGRATIONS_KEY_DEV_PLACEHOLDER;
    module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await module.init();
  });

  afterAll(() => module.close());

  it('runs the Repositories cleanup when an integration is deleted before any Repositories request', async () => {
    const ds = module.get(DataSource);
    const { userId, intruderId } = await seedTwoUserBaseline(ds);
    const intruderBefore = await snapshotUserRows(ds, intruderId);
    const integrationId = await seedIntegration(ds, userId);
    const key = `integration:${integrationId}`;
    const [{ uuid }]: Array<{ uuid: string }> = await ds.query('SELECT uuid FROM integrations WHERE id = ?', [integrationId]);

    await seedRepo(ds, userId, { githubId: 1, private: true, integrationId, sources: [[key, 1]] });
    await seedRepo(ds, userId, { githubId: 2, private: true, addedAt: new Date('2026-05-02T00:00:00Z'), integrationId, sources: [[key, 1]] });
    await seedPage(ds, userId, key, 1);
    await seedStatus(ds, userId, key, 'ok');

    await module.get(IntegrationsService).delete(userId, uuid);

    expect(await sourcesOf(ds, userId)).toEqual([]);
    expect(await pagesOf(ds, userId)).toEqual([]);
    expect(await statusesOf(ds, userId)).toEqual({});
    expect((await reposOf(ds, userId)).map((row) => [row.github_id, row.integration_id])).toEqual([['2', null]]);
    expect(await snapshotUserRows(ds, intruderId)).toEqual(intruderBefore);
  });
});
