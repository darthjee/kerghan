import { FakeClock } from '../../core/tests/support/fake-clock.js';
import type { RepositoriesService } from '../repositories.service.js';
import { RepositoriesHttpService } from '../repositories-http.service.js';
import type { RepositoryAddService } from '../repository-add.service.js';
import { FakeRepositoriesService, idleSyncState } from './support/fake-repositories.service.js';

const OWNER = 1;
const NOW = new Date('2026-11-07T12:00:00Z');

async function failure(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
  try {
    await promise;
  } catch (error) {
    const http = error as { getStatus(): number; getResponse(): unknown };

    return { status: http.getStatus(), body: http.getResponse() };
  }

  throw new Error('expected a rejection');
}

describe('RepositoriesHttpService', () => {
  let repositories: FakeRepositoriesService;
  let add: jest.Mock;
  let service: RepositoriesHttpService;

  beforeEach(() => {
    repositories = new FakeRepositoriesService();
    add = jest.fn();
    service = new RepositoriesHttpService(
      repositories as unknown as RepositoriesService,
      { add } as unknown as RepositoryAddService,
      new FakeClock(NOW),
    );
  });

  describe('listing', () => {
    it('triggers before reading, then reads the page and the sync state', async () => {
      const result = await service.listing(OWNER, { page: 1, perPage: 50, filter: 'all', search: '' });

      expect(repositories.calls.map((call) => call.method)).toEqual(['triggerIfStale', 'list', 'syncState']);
      expect(result.sync).toEqual(idleSyncState());
    });

    it('answers 401 for a deleted session user', async () => {
      repositories.markNoUser(OWNER);

      expect((await failure(service.listing(OWNER, { page: 1, perPage: 50, filter: 'all', search: '' }))).status).toBe(401);
      expect(repositories.callsOf('list')).toEqual([]);
    });
  });

  describe('syncState', () => {
    it('reconciles, never triggers', async () => {
      await service.syncState(OWNER);

      expect(repositories.calls.map((call) => call.method)).toEqual(['reconcileForRequest', 'syncState']);
    });

    it('answers 401 for a deleted session user', async () => {
      repositories.markNoUser(OWNER);

      expect((await failure(service.syncState(OWNER))).status).toBe(401);
    });
  });

  describe('refresh', () => {
    it.each([
      ['started', { kind: 'started' as const }],
      ['running', { kind: 'running' as const, startedAt: NOW }],
      ['fresh', { kind: 'fresh' as const }],
    ])('answers the sync state when %s', async (_label, outcome) => {
      repositories.setRefresh(OWNER, outcome);

      expect(await service.refresh(OWNER)).toEqual(idleSyncState());
    });

    it('answers 429 REPOSITORY_REFRESH_COOLDOWN with the delay, rounded up', async () => {
      repositories.setRefresh(OWNER, {
        kind: 'cooldown',
        lastStartedAt: NOW,
        refreshAvailableAt: new Date(NOW.getTime() + 120_400),
      });

      expect(await failure(service.refresh(OWNER))).toEqual({
        status: 429,
        body: {
          code: 'REPOSITORY_REFRESH_COOLDOWN',
          message: 'Repositories were synced recently; try again later',
          retryAfterSeconds: 121,
        },
      });
    });

    it('never answers a delay below one second', async () => {
      repositories.setRefresh(OWNER, { kind: 'cooldown', lastStartedAt: NOW, refreshAvailableAt: NOW });

      expect((await failure(service.refresh(OWNER))).body).toMatchObject({ retryAfterSeconds: 1 });
    });

    it('answers 401 for a deleted session user', async () => {
      repositories.markNoUser(OWNER);

      expect((await failure(service.refresh(OWNER))).status).toBe(401);
    });
  });

  it('delegates Add', async () => {
    add.mockResolvedValue('row');

    expect(await service.add(OWNER, { githubId: 5 })).toBe('row');
    expect(add).toHaveBeenCalledWith(OWNER, { githubId: 5 });
  });
});
