import { call, expectNoForbiddenKeys, OWNER_INTEGRATION, useRepositoriesTestApp } from './support/build-repositories-test-app.js';
import { expectErrorBody } from '../../auth/tests/support/error-body.js';
import type { SyncStateResult } from '../types/repositories-api.types.js';

function stateAt(now: Date): SyncStateResult {
  return {
    state: 'idle',
    startedAt: null,
    lastSyncedAt: now,
    refreshAvailableAt: null,
    sources: [
      { kind: 'integration', integration: { uuid: OWNER_INTEGRATION.uuid, label: OWNER_INTEGRATION.label }, status: 'ok', syncedAt: now, resetAt: null },
      { kind: 'handle', handle: 'darthjee', status: 'rate_limited', syncedAt: now, resetAt: new Date(now.getTime() + 60_000) },
    ],
  };
}

describe('Repositories sync routes (e2e)', () => {
  const { ctx } = useRepositoriesTestApp();

  describe('POST /repositories/sync/state.json', () => {
    it('answers the exact sync-state shape', async () => {
      ctx.repositories.setSyncState(ctx.ids.owner, stateAt(ctx.clock.now()));

      const response = await call(ctx.app, 'post', '/repositories/sync/state.json', ctx.owner).send({}).expect(200);

      expect(response.body).toEqual({
        state: 'idle',
        startedAt: null,
        lastSyncedAt: '2026-11-07T12:00:00.000Z',
        refreshAvailableAt: null,
        sources: [
          {
            kind: 'integration',
            integration: { uuid: OWNER_INTEGRATION.uuid, label: OWNER_INTEGRATION.label },
            status: 'ok',
            syncedAt: '2026-11-07T12:00:00.000Z',
            resetAt: null,
          },
          {
            kind: 'handle',
            handle: 'darthjee',
            status: 'rate_limited',
            syncedAt: '2026-11-07T12:00:00.000Z',
            resetAt: '2026-11-07T12:01:00.000Z',
          },
        ],
      });
      expectNoForbiddenKeys(response.body);
    });

    it('never starts a sync, and ignores a body', async () => {
      await call(ctx.app, 'post', '/repositories/sync/state.json', ctx.owner).send({ force: true, refresh: 1 }).expect(200);

      expect(ctx.repositories.calls.map((logged) => logged.method)).toEqual(['reconcileForRequest', 'syncState']);
      expect(ctx.launcher.launched).toBe(0);
    });
  });

  describe('POST /repositories/sync.json', () => {
    it.each([
      ['started', { kind: 'started' as const }],
      ['running', { kind: 'running' as const, startedAt: new Date('2026-11-07T11:59:00Z') }],
    ])('answers 202 with the sync state when %s', async (_label, outcome) => {
      ctx.repositories.setRefresh(ctx.ids.owner, outcome).setSyncState(ctx.ids.owner, stateAt(ctx.clock.now()));

      const response = await call(ctx.app, 'post', '/repositories/sync.json', ctx.owner).send({}).expect(202);

      expect(response.body.lastSyncedAt).toBe('2026-11-07T12:00:00.000Z');
      expect(ctx.repositories.calls.map((logged) => logged.method)).toEqual(['refresh', 'syncState']);
    });

    it('answers 429 REPOSITORY_REFRESH_COOLDOWN with Retry-After and error.retryAfterSeconds agreeing', async () => {
      ctx.repositories.setRefresh(ctx.ids.owner, {
        kind: 'cooldown',
        lastStartedAt: new Date(ctx.clock.now().getTime() - 60_000),
        refreshAvailableAt: new Date(ctx.clock.now().getTime() + 239_500),
      });

      const response = await call(ctx.app, 'post', '/repositories/sync.json', ctx.owner).send({});

      expectErrorBody(response, {
        status: 429,
        code: 'REPOSITORY_REFRESH_COOLDOWN',
        message: 'Repositories were synced recently; try again later',
      });
      expect(response.headers['retry-after']).toBe('240');
      expect(response.body.error.retryAfterSeconds).toBe(240);
      expect(response.headers['x-skip-cache']).toBe('true');
    });

    it('ignores a body', async () => {
      await call(ctx.app, 'post', '/repositories/sync.json', ctx.owner).send({ source: 'handle', force: true }).expect(202);

      expect(ctx.repositories.callsOf('refresh')[0].args).toEqual([]);
    });

    it('answers 401 when the session user no longer exists', async () => {
      ctx.repositories.markNoUser(ctx.ids.owner);

      expect((await call(ctx.app, 'post', '/repositories/sync.json', ctx.owner).send({})).status).toBe(401);
    });
  });
});
