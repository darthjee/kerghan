import { call, createIntegration, useIntegrationsTestApp } from './support/build-integrations-test-app.js';
import { githubUserResponse } from './support/fake-github-client.js';
import { CANARY_FINE } from './support/integrations-harness.js';

describe('IntegrationsController cache headers (e2e)', () => {
  const { ctx } = useIntegrationsTestApp();
  let id: string;

  beforeEach(async () => {
    id = (await createIntegration(ctx, ctx.owner, { label: 'Existing' })).body.id;
    ctx.repo.rows[0].lastTestedAt = null;
  });

  function expectNeverCached(response: { headers: Record<string, string> }): void {
    expect(response.headers['x-skip-cache']).toBe('true');
    expect(response.headers['cache-control']).toBe('no-store');
  }

  it.each([
    ['list', 'post', () => '/integrations/mine.json', {}, 200],
    ['types', 'post', () => '/integrations/types.json', {}, 200],
    ['show', 'post', (uuid: string) => `/integrations/${uuid}/show.json`, {}, 200],
    ['rename', 'patch', (uuid: string) => `/integrations/${uuid}.json`, { label: 'Renamed' }, 200],
    ['replace', 'post', (uuid: string) => `/integrations/${uuid}/credential.json`, { credential: { token: CANARY_FINE } }, 200],
    ['test', 'post', (uuid: string) => `/integrations/${uuid}/test.json`, {}, 200],
    ['delete', 'delete', (uuid: string) => `/integrations/${uuid}.json`, {}, 204],
  ] as const)('marks the %s response as never cached', async (_label, method, path, body, status) => {
    const response = await call(ctx.app, method, path(id), ctx.owner).send(body).expect(status);

    expectNeverCached(response);
  });

  it('marks the create response as never cached', async () => {
    const response = await createIntegration(ctx, ctx.owner, { label: 'New' });

    expect(response.status).toBe(201);
    expectNeverCached(response);
  });

  it('marks error responses as never cached too', async () => {
    ctx.github.respondWith(githubUserResponse({ status: 401, login: null }));

    const response = await createIntegration(ctx, ctx.owner, { label: 'Rejected' });

    expect(response.status).toBe(422);
    expect(response.headers['x-skip-cache']).toBe('true');
  });
});
