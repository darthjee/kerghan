import { RepositoriesService } from '../repositories.service.js';
import { seedRepo, seedStatus, seedSyncState } from './support/repo-rows.js';
import { buildRepositoriesDbHarness, type RepositoriesDbHarness } from './support/repositories-db-harness.js';
import { ref } from './support/sync-harness.js';
import { seedUser } from './support/two-user-baseline.js';

const ADDED = new Date('2026-05-02T00:00:00Z');

describe('RepositoriesService project lookups (real MySQL)', () => {
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
    userId = await seedUser(harness.ds, 'owner', 'darthjee');
    otherId = await seedUser(harness.ds, 'other');
    await seedSyncState(harness.ds, userId, { handle: 'darthjee' });
    harness.github.setUsable(userId, [ref(1)]);
    await seedStatus(harness.ds, userId, 'integration:1', 'ok');
  });

  describe('resolveForProject', () => {
    it('answers null for a ref the caller does not hold, and never returns another user\'s row', async () => {
      await seedRepo(harness.ds, otherId, { githubId: 5, owner: 'o', name: 'r', addedAt: ADDED });

      expect(await service.resolveForProject(userId, { githubId: 5 })).toBeNull();
      expect(await service.resolveForProject(userId, { fullName: 'o/r' })).toBeNull();
      expect(await service.resolveForProject(userId, { fullName: 'o/r/x' })).toBeNull();
    });

    it('reports a not-added row with added false', async () => {
      const id = await seedRepo(harness.ds, userId, { githubId: 5, owner: 'o', name: 'r', sources: [['integration:1', 1]] });

      expect(await service.resolveForProject(userId, { githubId: 5 })).toEqual({
        repositoryId: id,
        added: false,
        summary: { githubId: 5, owner: 'o', name: 'r', fullName: 'o/r', private: false, status: 'not_added' },
      });
    });

    it.each([
      ['added', { sources: [['integration:1', 1]] as Array<[string, number]> }, 'added'],
      ['unavailable', {}, 'unavailable'],
      ['unknown', { sources: [['handle', 1]] as Array<[string, number]> }, 'unknown'],
    ])('reports an added row with the derived status %s', async (_label, extra, status) => {
      const id = await seedRepo(harness.ds, userId, { githubId: 5, owner: 'o', name: 'r', addedAt: ADDED, ...extra });

      expect(await service.resolveForProject(userId, { githubId: 5 })).toEqual({
        repositoryId: id,
        added: true,
        summary: expect.objectContaining({ status }),
      });
    });

    it('matches fullName case-insensitively', async () => {
      await seedRepo(harness.ds, userId, { githubId: 5, owner: 'Darth', name: 'Kerghan', addedAt: ADDED });

      expect((await service.resolveForProject(userId, { fullName: 'darth/KERGHAN' }))?.summary.fullName).toBe('Darth/Kerghan');
    });

    it('exposes no internal id inside the summary', async () => {
      await seedRepo(harness.ds, userId, { githubId: 5, addedAt: ADDED });

      const lookup = await service.resolveForProject(userId, { githubId: 5 });

      expect(Object.keys(lookup?.summary ?? {}).sort()).toEqual(['fullName', 'githubId', 'name', 'owner', 'private', 'status']);
    });
  });

  describe('projectSummaries', () => {
    it('answers an empty map for no ids', async () => {
      expect((await service.projectSummaries(userId, [])).size).toBe(0);
    });

    it('answers the summaries of the user\'s rows; a dangling or foreign id is absent', async () => {
      const mine = await seedRepo(harness.ds, userId, { githubId: 5, owner: 'o', name: 'r', addedAt: ADDED, sources: [['integration:1', 1]] });
      const notAdded = await seedRepo(harness.ds, userId, { githubId: 6, owner: 'o', name: 's' });
      const foreign = await seedRepo(harness.ds, otherId, { githubId: 7, owner: 'o', name: 't', addedAt: ADDED });
      const dangling = foreign + 1000;

      const summaries = await service.projectSummaries(userId, [mine, notAdded, foreign, dangling, mine]);

      expect([...summaries.keys()].sort((a, b) => a - b)).toEqual([mine, notAdded].sort((a, b) => a - b));
      expect(summaries.get(mine)).toEqual({ githubId: 5, owner: 'o', name: 'r', fullName: 'o/r', private: false, status: 'added' });
      expect(summaries.get(notAdded)?.status).toBe('not_added');
    });

    it('reads many ids with the same number of queries as one', async () => {
      const ids = [
        await seedRepo(harness.ds, userId, { githubId: 5, addedAt: ADDED }),
        await seedRepo(harness.ds, userId, { githubId: 6, addedAt: ADDED }),
        await seedRepo(harness.ds, userId, { githubId: 7, addedAt: ADDED }),
      ];
      const spy = jest.spyOn(harness.ds, 'query');

      await service.projectSummaries(userId, ids.slice(0, 1));
      const one = spy.mock.calls.length;
      spy.mockClear();
      await service.projectSummaries(userId, ids);

      expect(spy.mock.calls.length).toBe(one);
      spy.mockRestore();
    });
  });
});
