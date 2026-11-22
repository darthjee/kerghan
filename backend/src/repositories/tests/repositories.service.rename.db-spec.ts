import { RepositoriesService } from '../repositories.service.js';
import { seedRepo } from './support/repo-rows.js';
import { buildRepositoriesDbHarness, type RepositoriesDbHarness } from './support/repositories-db-harness.js';
import { seedUser } from './support/two-user-baseline.js';

const ADDED = new Date('2026-05-02T00:00:00Z');

describe('RepositoriesService#applyRename (real MySQL)', () => {
  let harness: RepositoriesDbHarness;
  let service: RepositoriesService;
  let userId: number;
  let otherId: number;

  beforeAll(async () => {
    harness = await buildRepositoriesDbHarness();
    service = harness.get(RepositoriesService);
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    userId = await seedUser(harness.ds, 'owner');
    otherId = await seedUser(harness.ds, 'other');
  });

  async function row(id: number): Promise<{ owner: string; name: string; added_at: Date | null; integration_id: number | null }> {
    const rows: Array<{ owner: string; name: string; added_at: Date | null; integration_id: number | null }> = await harness.ds.query(
      'SELECT owner, name, added_at, integration_id FROM repositories WHERE id = ?',
      [id],
    );

    return rows[0];
  }

  it('refreshes the stored owner and name and nothing else on the row', async () => {
    const id = await seedRepo(harness.ds, userId, { githubId: 5, owner: 'old', name: 'name', addedAt: ADDED, integrationId: 9 });

    await service.applyRename(userId, id, { owner: 'new', name: 'renamed' });

    expect(await row(id)).toEqual({ owner: 'new', name: 'renamed', added_at: ADDED, integration_id: 9 });
  });

  it('never writes another user\'s row', async () => {
    const id = await seedRepo(harness.ds, otherId, { githubId: 5, owner: 'old', name: 'name', addedAt: ADDED });

    await service.applyRename(userId, id, { owner: 'new', name: 'renamed' });

    expect(await row(id)).toMatchObject({ owner: 'old', name: 'name' });
  });

  it('is a no-op for a row that does not exist', async () => {
    await expect(service.applyRename(userId, 999_999, { owner: 'new', name: 'renamed' })).resolves.toBeUndefined();
  });
});
