import { Pruner } from '../pruner.js';
import { RepositoriesService } from '../repositories.service.js';
import { reposOf, seedRepo, seedStatus, seedSyncState } from './support/repo-rows.js';
import { buildRepositoriesDbHarness, HARNESS_START, type RepositoriesDbHarness } from './support/repositories-db-harness.js';
import { ref } from './support/sync-harness.js';
import { seedUser } from './support/two-user-baseline.js';

const OLD = new Date('2026-05-01T00:00:00Z');
const NEW = new Date('2026-05-03T00:00:00Z');

describe('RepositoriesService findByRef / markAdded (real MySQL)', () => {
  let harness: RepositoriesDbHarness;
  let service: RepositoriesService;
  let userId: number;

  beforeAll(async () => {
    harness = await buildRepositoriesDbHarness();
    service = harness.get(RepositoriesService);
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    userId = await seedUser(harness.ds, 'owner', 'darthjee');
    await seedSyncState(harness.ds, userId, { handle: 'darthjee' });
    harness.github.setUsable(userId, [ref(1), ref(2)]);
    await seedStatus(harness.ds, userId, 'integration:1', 'ok');
  });

  describe('findByRef', () => {
    it('finds by githubId with Add\'s candidate inputs, and answers null for an unknown ref', async () => {
      await seedRepo(harness.ds, userId, { githubId: 5, owner: 'o', name: 'r', private: true, sources: [['integration:1', 1], ['handle', 1]] });

      expect(await service.findByRef(userId, { githubId: 5 })).toMatchObject({
        githubId: 5, fullName: 'o/r', status: 'not_added', addedAt: null, holderIntegrationIds: [1], handleSeesRepo: true,
      });
      expect(await service.findByRef(userId, { githubId: 6 })).toBeNull();
      expect(await service.findByRef(userId, { fullName: 'nope/r' })).toBeNull();
      expect(await service.findByRef(userId, { fullName: 'o/r/x' })).toBeNull();
      expect(harness.github.githubCalls()).toEqual([]);
    });

    it('matches fullName case-insensitively; a tie breaks on the latest last_seen_at, then the highest id', async () => {
      await seedRepo(harness.ds, userId, { githubId: 10, owner: 'Darth', name: 'Kerghan', lastSeenAt: OLD });
      await seedRepo(harness.ds, userId, { githubId: 11, owner: 'darth', name: 'kerghan', lastSeenAt: NEW });
      await seedRepo(harness.ds, userId, { githubId: 12, owner: 'darth', name: 'KERGHAN', lastSeenAt: OLD });

      expect((await service.findByRef(userId, { fullName: 'DARTH/kerghan' }))?.githubId).toBe(11);

      await harness.ds.query('UPDATE repositories SET last_seen_at = ? WHERE user_id = ?', [NEW, userId]);
      expect((await service.findByRef(userId, { fullName: 'darth/kerghan' }))?.githubId).toBe(12);
    });
  });

  describe('markAdded', () => {
    it('marks a not-added row with its link and snapshot, answering the listing row', async () => {
      await seedRepo(harness.ds, userId, { githubId: 5, owner: 'o', name: 'r', sources: [['integration:1', 1]] });

      const outcome = await service.markAdded(userId, { githubId: 5 }, 1, { owner: 'o2', name: 'r2', private: true });

      expect(outcome).toEqual({
        kind: 'added',
        repository: expect.objectContaining({
          githubId: 5, fullName: 'o2/r2', private: true, status: 'added', addedAt: HARNESS_START,
          accessIntegration: { uuid: 'uuid-1', label: 'label-1' },
        }),
      });
    });

    it('answers already_added for an added row, keeping its addedAt and link', async () => {
      await seedRepo(harness.ds, userId, { githubId: 5, addedAt: OLD, integrationId: 2, sources: [['integration:1', 1]] });

      expect(await service.markAdded(userId, { fullName: 'octo/repo-5' }, 1)).toEqual({
        kind: 'already_added',
        repository: expect.objectContaining({ addedAt: OLD, accessIntegration: { uuid: 'uuid-2', label: 'label-2' } }),
      });
    });

    it('answers gone for a row that does not exist (pruned)', async () => {
      expect(await service.markAdded(userId, { githubId: 5 }, null)).toEqual({ kind: 'gone' });
    });

    it('pruning vs Add: Add first ⇒ the prune skips the row', async () => {
      await seedRepo(harness.ds, userId, { githubId: 5 });

      await service.markAdded(userId, { githubId: 5 }, null);
      await harness.ds.transaction((manager) => harness.get(Pruner).prune(manager, userId));

      expect((await reposOf(harness.ds, userId)).map((row) => row.github_id)).toEqual(['5']);
    });

    it('pruning vs Add: prune first ⇒ Add finds the row gone', async () => {
      await seedRepo(harness.ds, userId, { githubId: 5 });
      const found = await service.findByRef(userId, { githubId: 5 });

      await harness.ds.transaction((manager) => harness.get(Pruner).prune(manager, userId));

      expect(found).not.toBeNull();
      expect(await service.markAdded(userId, { githubId: 5 }, null)).toEqual({ kind: 'gone' });
    });

    it('a double markAdded writes once (concurrent, separate connections)', async () => {
      await seedRepo(harness.ds, userId, { githubId: 5, sources: [['integration:1', 1]] });

      const outcomes = await Promise.all([
        service.markAdded(userId, { githubId: 5 }, 1),
        service.markAdded(userId, { githubId: 5 }, 2),
      ]);
      const [row] = await reposOf(harness.ds, userId);

      expect(outcomes.map((outcome) => outcome.kind).sort()).toEqual(['added', 'already_added']);
      const winner = outcomes.find((outcome) => outcome.kind === 'added');

      expect(winner?.kind === 'added' && winner.repository.accessIntegration?.uuid).toBe(`uuid-${row.integration_id}`);
      expect(outcomes.every((outcome) => outcome.kind !== 'gone' && outcome.repository.accessIntegration?.uuid === `uuid-${row.integration_id}`))
        .toBe(true);
    });
  });
});
