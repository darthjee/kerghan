import type { SourceStatus } from '../entities/repository-source-status.entity.js';
import { RepositoriesService } from '../repositories.service.js';
import { deriveRowStatus } from '../row-status.js';
import type { ListInput } from '../types/repositories-api.types.js';
import { seedRepo, seedStatus, seedSyncState } from './support/repo-rows.js';
import { buildRepositoriesDbHarness, type RepositoriesDbHarness } from './support/repositories-db-harness.js';
import { ref } from './support/sync-harness.js';
import { seedUser } from './support/two-user-baseline.js';

const ADDED = new Date('2026-05-02T00:00:00Z');
const ALL: ListInput = { page: 1, perPage: 50, filter: 'all', search: '' };

describe('RepositoriesService#list (real MySQL)', () => {
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
    // integration 1 (ok), integration 2 (error); integration 9 was deleted (dangling).
    harness.github.setUsable(userId, [ref(1), ref(2)]);
    await seedStatus(harness.ds, userId, 'integration:1', 'ok');
    await seedStatus(harness.ds, userId, 'integration:2', 'error');
  });

  const names = async (input: Partial<ListInput>): Promise<string[]> => (
    (await service.list(userId, { ...ALL, ...input })).repositories.map((row) => row.fullName)
  );

  /** Seeds one row of each status. */
  async function seedStatuses(): Promise<void> {
    await seedRepo(harness.ds, userId, { githubId: 1, owner: 'a', name: 'not-added', sources: [['integration:1', 1]] });
    await seedRepo(harness.ds, userId, { githubId: 2, owner: 'a', name: 'added', addedAt: ADDED, sources: [['integration:1', 1]] });
    await seedRepo(harness.ds, userId, { githubId: 3, owner: 'a', name: 'gone', addedAt: ADDED });
    await seedRepo(harness.ds, userId, { githubId: 4, owner: 'a', name: 'unknown', addedAt: ADDED, sources: [['integration:2', 1]] });
    await seedRepo(harness.ds, userId, {
      githubId: 5, owner: 'a', name: 'dangling', private: true, addedAt: ADDED, integrationId: 9, sources: [['integration:1', 1]],
    });
    await seedRepo(harness.ds, userId, { githubId: 6, owner: 'a', name: 'pending', addedAt: ADDED, sources: [['handle', 1]] });
    // A leftover row of the deleted integration 9 (not a current source) never counts.
    await seedRepo(harness.ds, userId, { githubId: 7, owner: 'a', name: 'stale-only', addedAt: ADDED, sources: [['integration:9', 1]] });
    await seedStatus(harness.ds, userId, 'integration:9', 'ok');
  }

  it('applies each filter before pagination; unknown rows show only under all', async () => {
    await seedStatuses();

    expect(await names({ filter: 'added' })).toEqual(['a/added']);
    expect(await names({ filter: 'not_added' })).toEqual(['a/not-added']);
    expect(await names({ filter: 'unavailable' })).toEqual(['a/dangling', 'a/gone', 'a/stale-only']);
    expect(await names({})).toHaveLength(7);
    expect(await service.list(userId, { ...ALL, filter: 'unavailable', perPage: 2, page: 2 })).toMatchObject({
      repositories: [{ fullName: 'a/stale-only' }], total: 3, totalPages: 2,
    });
  });

  it('derives the same status in SQL as the reference pure function', async () => {
    await seedStatuses();
    const statuses = new Map<string, SourceStatus>([['integration:1', 'ok'], ['integration:2', 'error']]);
    const rows = (await service.list(userId, ALL)).repositories;

    for (const row of rows) {
      const keys = row.sources.map((source) => (source.kind === 'handle' ? 'handle' : `integration:${source.integration.label.split('-')[1]}`));
      const integrationId = row.fullName === 'a/dangling' ? 9 : null;
      const expected = deriveRowStatus({ addedAt: row.addedAt, private: row.private, integrationId }, keys, statuses, new Set([1, 2]));

      expect([row.fullName, row.status]).toEqual([row.fullName, expected]);
    }
    expect(rows.map((row) => [row.name, row.status])).toEqual([
      ['added', 'added'], ['dangling', 'unavailable'], ['gone', 'unavailable'], ['not-added', 'not_added'],
      ['pending', 'unknown'], ['stale-only', 'unavailable'], ['unknown', 'unknown'],
    ]);
  });

  it('searches a case-insensitive literal substring of owner/name, %, _ and \\ included', async () => {
    await seedRepo(harness.ds, userId, { githubId: 1, owner: 'Darth', name: 'Kerghan' });
    await seedRepo(harness.ds, userId, { githubId: 2, owner: 'x', name: '100%_done' });
    await seedRepo(harness.ds, userId, { githubId: 3, owner: 'x', name: '100xydone' });
    await seedRepo(harness.ds, userId, { githubId: 4, owner: 'x', name: 'back\\slash' });
    await seedRepo(harness.ds, userId, { githubId: 5, owner: 'x', name: 'backxslash' });

    expect(await names({ search: 'th/KERG' })).toEqual(['Darth/Kerghan']);
    expect(await names({ search: '%_' })).toEqual(['x/100%_done']);
    expect(await names({ search: '0%' })).toEqual(['x/100%_done']);
    expect(await names({ search: 'k\\s' })).toEqual(['x/back\\slash']);
    expect(await names({ search: 'nothing' })).toEqual([]);
  });

  it('sorts case-insensitively by owner, then name, then github_id, with stable totals; a page past the end is empty', async () => {
    await seedRepo(harness.ds, userId, { githubId: 30, owner: 'b', name: 'z' });
    await seedRepo(harness.ds, userId, { githubId: 20, owner: 'B', name: 'a' });
    await seedRepo(harness.ds, userId, { githubId: 11, owner: 'a', name: 'Same' });
    await seedRepo(harness.ds, userId, { githubId: 10, owner: 'A', name: 'same' });

    expect((await service.list(userId, ALL)).repositories.map((row) => row.githubId)).toEqual([10, 11, 20, 30]);
    expect(await service.list(userId, { ...ALL, perPage: 3, page: 2 })).toMatchObject({
      repositories: [{ githubId: 30 }], page: 2, perPage: 3, total: 4, totalPages: 2,
    });
    expect(await service.list(userId, { ...ALL, perPage: 3, page: 5 })).toMatchObject({ repositories: [], total: 4, totalPages: 2 });
  });

  it('lists the current sources and the access integration; a dangling link reads null; no GitHub call, no internal id', async () => {
    await seedRepo(harness.ds, userId, {
      githubId: 2 ** 31 + 1, owner: 'o', name: 'linked', private: true, addedAt: ADDED, integrationId: 2,
      sources: [['handle', 1], ['integration:2', 1], ['integration:1', 3], ['integration:9', 1]],
    });
    await seedRepo(harness.ds, userId, { githubId: 3, owner: 'o', name: 'dangling', addedAt: ADDED, integrationId: 9 });
    await seedRepo(harness.ds, userId, { githubId: 4, owner: 'o', name: 'not-added', integrationId: 1 });

    const [dangling, linked, notAdded] = (await service.list(userId, ALL)).repositories;

    expect(linked).toEqual({
      githubId: 2 ** 31 + 1, owner: 'o', name: 'linked', fullName: 'o/linked', private: true, status: 'added',
      addedAt: ADDED, lastSeenAt: expect.any(Date),
      sources: [
        { kind: 'integration', integration: { uuid: 'uuid-1', label: 'label-1' } },
        { kind: 'integration', integration: { uuid: 'uuid-2', label: 'label-2' } },
        { kind: 'handle', handle: 'darthjee' },
      ],
      accessIntegration: { uuid: 'uuid-2', label: 'label-2' },
    });
    expect(dangling.accessIntegration).toBeNull();
    expect(notAdded.accessIntegration).toBeNull();
    expect(harness.github.githubCalls()).toEqual([]);
  });

  it('works with no integration and no handle', async () => {
    const lonely = await seedUser(harness.ds, 'lonely');

    await seedRepo(harness.ds, lonely, { githubId: 1, addedAt: ADDED });

    expect((await service.list(lonely, ALL)).repositories).toMatchObject([{ status: 'unavailable', sources: [] }]);
  });
});
