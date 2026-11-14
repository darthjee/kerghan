import { call, expectNoForbiddenKeys, OWNER_INTEGRATION, useRepositoriesTestApp } from './support/build-repositories-test-app.js';
import { expectValidationErrorBody } from '../../auth/tests/support/error-body.js';

describe('POST /repositories/mine.json (e2e)', () => {
  const { ctx } = useRepositoriesTestApp();

  function list(body: Record<string, unknown> = {}) {
    return call(ctx.app, 'post', '/repositories/mine.json', ctx.owner).send(body);
  }

  it('answers the exact shape with the defaults', async () => {
    const response = await list().expect(200);

    expect(response.body).toEqual({
      repositories: [{
        githubId: 4_000_000_001,
        owner: 'darthjee',
        name: 'kerghan',
        fullName: 'darthjee/kerghan',
        private: false,
        status: 'not_added',
        addedAt: null,
        lastSeenAt: '2026-11-07T12:00:00.000Z',
        sources: [{ kind: 'integration', integration: { uuid: OWNER_INTEGRATION.uuid, label: OWNER_INTEGRATION.label } }],
        accessIntegration: null,
      }],
      pagination: { page: 1, perPage: 50, total: 1, totalPages: 1 },
      sync: { state: 'idle', startedAt: null, lastSyncedAt: null, refreshAvailableAt: null, sources: [] },
    });
    expect(ctx.repositories.callsOf('list')[0].args).toEqual([{ page: 1, perPage: 50, filter: 'all', search: '' }]);
    expectNoForbiddenKeys(response.body);
  });

  it('passes the validated input through, search trimmed', async () => {
    await list({ page: 2, perPage: 100, filter: 'not_added', search: '  50%_  ' }).expect(200);

    expect(ctx.repositories.callsOf('list')[0].args).toEqual([{ page: 2, perPage: 100, filter: 'not_added', search: '50%_' }]);
  });

  it('answers a past-the-end page with 200 and an empty list', async () => {
    const response = await list({ page: 9 }).expect(200);

    expect(response.body.repositories).toEqual([]);
    expect(response.body.pagination).toEqual({ page: 9, perPage: 50, total: 1, totalPages: 1 });
  });

  it('strips and ignores unknown body properties', async () => {
    await list({ sort: 'name', userId: 2, id: 1 }).expect(200);

    expect(ctx.repositories.callsOf('list')[0].args).toEqual([{ page: 1, perPage: 50, filter: 'all', search: '' }]);
  });

  it.each([
    ['page 0', { page: 0 }],
    ['page not an integer', { page: 1.5 }],
    ['perPage over 100', { perPage: 101 }],
    ['perPage 0', { perPage: 0 }],
    ['filter unknown', { filter: 'unknown' }],
    ['search over 100 characters', { search: 'a'.repeat(101) }],
    ['search not a string', { search: 3 }],
  ])('answers 400 VALIDATION_FAILED for %s, with no read', async (_label, body) => {
    const response = await list(body);

    expectValidationErrorBody(response);
    expect(response.headers['x-skip-cache']).toBe('true');
    expect(ctx.repositories.calls).toEqual([]);
  });

  it('triggers before reading, so a sync it started reads syncing', async () => {
    ctx.repositories.setTrigger(ctx.ids.owner, { kind: 'started' }).setSyncState(ctx.ids.owner, {
      state: 'syncing', startedAt: ctx.clock.now(), lastSyncedAt: null, refreshAvailableAt: new Date(ctx.clock.now().getTime() + 300_000), sources: [],
    });

    const response = await list().expect(200);

    expect(ctx.repositories.calls.map((logged) => logged.method)).toEqual(['triggerIfStale', 'list', 'syncState']);
    expect(response.body.sync).toEqual({
      state: 'syncing',
      startedAt: '2026-11-07T12:00:00.000Z',
      lastSyncedAt: null,
      refreshAvailableAt: '2026-11-07T12:05:00.000Z',
      sources: [],
    });
  });

  it('never calls GitHub', async () => {
    await list().expect(200);

    expect(ctx.github.githubCalls()).toEqual([]);
  });

  it('answers 401 when the session user no longer exists', async () => {
    ctx.repositories.markNoUser(ctx.ids.owner);

    expect((await list()).status).toBe(401);
    expect(ctx.repositories.callsOf('list')).toEqual([]);
  });
});
