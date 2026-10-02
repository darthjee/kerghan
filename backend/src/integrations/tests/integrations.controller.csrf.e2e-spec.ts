import { call, createIntegration, useIntegrationsTestApp } from './support/build-integrations-test-app.js';
import { CANARY_FINE } from './support/integrations-harness.js';
import { expectErrorBody } from '../../auth/tests/support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';

const CROSS_SITE = { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://evil.example' };

describe('IntegrationsController CSRF protection (e2e)', () => {
  const { ctx } = useIntegrationsTestApp();
  let id: string;

  beforeEach(async () => {
    id = (await createIntegration(ctx, ctx.owner)).body.id;
    ctx.github.reset();
  });

  it.each([
    ['post', () => '/integrations.json', { label: 'X', provider: 'github', type: 'pat', credential: { token: CANARY_FINE } }],
    ['post', () => '/integrations/mine.json', {}],
    ['patch', (uuid: string) => `/integrations/${uuid}.json`, { label: 'Hijacked' }],
    ['post', (uuid: string) => `/integrations/${uuid}/credential.json`, { credential: { token: CANARY_FINE } }],
    ['post', (uuid: string) => `/integrations/${uuid}/test.json`, {}],
    ['delete', (uuid: string) => `/integrations/${uuid}.json`, {}],
  ] as const)('rejects a cross-site %s with 403, even with the session cookie', async (method, path, body) => {
    const response = await call(ctx.app, method, path(id), ctx.owner).set(CROSS_SITE).send(body);

    expectErrorBody(response, { status: 403, code: ErrorCodes.FORBIDDEN });
    expect(ctx.repo.rows).toHaveLength(1);
    expect(ctx.repo.rows[0].label).toBe('Work');
    expect(ctx.github.callCount).toBe(0);
  });

  it('accepts a same-origin request', async () => {
    await call(ctx.app, 'patch', `/integrations/${id}.json`, ctx.owner)
      .set({ 'Sec-Fetch-Site': 'same-origin' })
      .send({ label: 'Renamed' })
      .expect(200);
  });
});
