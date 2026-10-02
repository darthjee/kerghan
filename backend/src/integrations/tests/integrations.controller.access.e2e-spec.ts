import { call, createIntegration, useIntegrationsTestApp } from './support/build-integrations-test-app.js';
import { CANARY_FINE } from './support/integrations-harness.js';
import { expectErrorBody } from '../../auth/tests/support/error-body.js';

const MISSING = '00000000-0000-4000-8000-000000000000';

type Method = 'post' | 'patch' | 'delete';

const UUID_ROUTES: Array<[Method, (uuid: string) => string, Record<string, unknown>]> = [
  ['post', (uuid) => `/integrations/${uuid}/show.json`, {}],
  ['patch', (uuid) => `/integrations/${uuid}.json`, { label: 'Mine now' }],
  ['post', (uuid) => `/integrations/${uuid}/credential.json`, { credential: { token: CANARY_FINE } }],
  ['post', (uuid) => `/integrations/${uuid}/test.json`, {}],
  ['delete', (uuid) => `/integrations/${uuid}.json`, {}],
];

const ALL_ROUTES: Array<[Method, string]> = [
  ['post', '/integrations/mine.json'],
  ['post', '/integrations/types.json'],
  ['post', '/integrations.json'],
  ...UUID_ROUTES.map(([method, path]): [Method, string] => [method, path(MISSING)]),
];

function bodyWithoutTimestamp(body: Record<string, unknown>): Record<string, unknown> {
  return { ...body, timestamp: null };
}

describe('IntegrationsController access rules (e2e)', () => {
  const { ctx } = useIntegrationsTestApp();
  let foreign: string;

  beforeEach(async () => {
    foreign = (await createIntegration(ctx, ctx.owner)).body.id;
    ctx.github.reset();
  });

  it.each(ALL_ROUTES)('answers 401 to an unauthenticated %s %s', async (method, path) => {
    expectErrorBody(await call(ctx.app, method, path).send({}), { status: 401, code: 'UNAUTHORIZED' });
  });

  it.each(UUID_ROUTES)('answers %s %s on a foreign uuid with the same 404 as a missing one', async (method, path, body) => {
    const onForeign = await call(ctx.app, method, path(foreign), ctx.intruder).send(body);
    const onMissing = await call(ctx.app, method, path(MISSING), ctx.intruder).send(body);

    expectErrorBody(onForeign, { status: 404, code: 'NOT_FOUND', message: 'Integration not found' });
    expect(bodyWithoutTimestamp(onForeign.body)).toEqual(bodyWithoutTimestamp(onMissing.body));
    expect(ctx.repo.rows[0]).toMatchObject({ label: 'Work', userId: ctx.userRepo.rows[0].id });
    expect(ctx.github.callCount).toBe(0);
  });

  it.each(UUID_ROUTES)('answers %s %s on a malformed uuid with 404', async (method, path, body) => {
    expectErrorBody(await call(ctx.app, method, path('not-a-uuid'), ctx.owner).send(body), {
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it.each(UUID_ROUTES)('denies an admin %s %s on another user\'s integration (404)', async (method, path, body) => {
    expectErrorBody(await call(ctx.app, method, path(foreign), ctx.admin).send(body), { status: 404, code: 'NOT_FOUND' });
    expect(ctx.repo.rows).toHaveLength(1);
  });

  it('does not list another user\'s integrations, even to an admin', async () => {
    const response = await call(ctx.app, 'post', '/integrations/mine.json', ctx.admin).expect(200);

    expect(response.body).toEqual({ integrations: [] });
  });

  it('answers 404 (not 429) on test of a foreign uuid in its cooldown', async () => {
    ctx.repo.rows[0].lastTestedAt = new Date();

    expectErrorBody(await call(ctx.app, 'post', `/integrations/${foreign}/test.json`, ctx.intruder), {
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('answers 404 (not 400 or 423) on replace of a foreign uuid with an invalid payload or while locked', async () => {
    ctx.guard.state.set(ctx.userRepo.rows[1].id, { failedAttempts: 9, lockedUntil: new Date(Date.now() + 60000) });

    expectErrorBody(
      await call(ctx.app, 'post', `/integrations/${foreign}/credential.json`, ctx.intruder).send({ credential: { bogus: 1 } }),
      { status: 404, code: 'NOT_FOUND' },
    );
  });
});
