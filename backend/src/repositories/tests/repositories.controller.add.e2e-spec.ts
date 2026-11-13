import {
  call,
  expectNoForbiddenKeys,
  INTRUDER_ONLY_GITHUB_ID,
  MISSING_GITHUB_ID,
  OWNER_INTEGRATION,
  SHARED_GITHUB_ID,
  useRepositoriesTestApp,
  withoutTimestamp,
} from './support/build-repositories-test-app.js';
import { expectErrorBody, expectValidationErrorBody } from '../../auth/tests/support/error-body.js';
import {
  forbidden,
  notFound,
  rateLimited,
  redirect,
  repository,
  serverError,
  timeout,
} from '../../integrations/tests/support/github-builders.js';

const KERGHAN = { githubId: SHARED_GITHUB_ID, owner: 'darthjee', name: 'kerghan', private: false };

describe('POST /repositories/add.json (e2e)', () => {
  const { ctx } = useRepositoriesTestApp();

  function add(body: Record<string, unknown>, cookie = ctx.owner) {
    return call(ctx.app, 'post', '/repositories/add.json', cookie).send(body);
  }

  describe('validation', () => {
    it.each([
      ['neither ref', {}],
      ['both refs', { githubId: SHARED_GITHUB_ID, fullName: 'darthjee/kerghan' }],
      ['githubId 0', { githubId: 0 }],
      ['githubId negative', { githubId: -1 }],
      ['githubId fractional', { githubId: 1.5 }],
      ['githubId above MAX_SAFE_INTEGER', { githubId: Number.MAX_SAFE_INTEGER + 2 }],
      ['githubId 1e300', { githubId: 1e300 }],
      ['githubId a string', { githubId: '4000000001' }],
      ['fullName with no slash', { fullName: 'darthjee' }],
      ['fullName with two slashes', { fullName: 'a/b/c' }],
      ['fullName name "."', { fullName: 'darthjee/.' }],
      ['fullName name ".."', { fullName: 'darthjee/..' }],
      ['owner with --', { fullName: 'darth--jee/kerghan' }],
      ['owner with a leading hyphen', { fullName: '-darthjee/kerghan' }],
      ['owner with a trailing hyphen', { fullName: 'darthjee-/kerghan' }],
      ['owner of 40 characters', { fullName: `${'a'.repeat(40)}/kerghan` }],
      ['name over 100 characters', { fullName: `darthjee/${'k'.repeat(101)}` }],
    ])('answers 400 for %s, before the rate limit and the lookup', async (_label, body) => {
      const response = await add(body);

      expectValidationErrorBody(response);
      expect(response.headers['x-skip-cache']).toBe('true');
      expect(ctx.repositories.calls).toEqual([]);
    });
  });

  describe('lookup', () => {
    it.each([
      ['a missing githubId', { githubId: MISSING_GITHUB_ID }],
      ['an intruder-only githubId', { githubId: INTRUDER_ONLY_GITHUB_ID }],
      ['an intruder-only fullName', { fullName: 'evil/secret' }],
      ['a missing fullName', { fullName: 'darthjee/nothing' }],
    ])('answers 404 for %s, with no GitHub call and no write', async (_label, body) => {
      const response = await add(body);

      expectErrorBody(response, { status: 404, code: 'NOT_FOUND', message: 'Repository not found' });
      expect(response.headers['x-skip-cache']).toBe('true');
      expect(ctx.github.githubCalls()).toEqual([]);
      expect(ctx.repositories.callsOf('markAdded')).toEqual([]);
    });

    it('answers an already-added row with 200, no GitHub call and addedAt unchanged', async () => {
      const addedAt = new Date('2026-10-01T00:00:00Z');
      ctx.repositories.seed(ctx.ids.owner, { githubId: 7, owner: 'darthjee', name: 'old', addedAt });

      const response = await add({ githubId: 7 }).expect(200);

      expect(response.body).toMatchObject({ githubId: 7, status: 'added', addedAt: '2026-10-01T00:00:00.000Z' });
      expect(ctx.github.githubCalls()).toEqual([]);
      expect(ctx.repositories.callsOf('markAdded')).toEqual([]);
    });
  });

  describe('re-check and write', () => {
    it('adds with 200 and the listing row shape, linking the holder', async () => {
      ctx.github.script(OWNER_INTEGRATION.id, 'getRepository', '*', repository(KERGHAN));

      const response = await add({ githubId: SHARED_GITHUB_ID }).expect(200);

      expect(response.body).toEqual({
        githubId: SHARED_GITHUB_ID,
        owner: 'darthjee',
        name: 'kerghan',
        fullName: 'darthjee/kerghan',
        private: false,
        status: 'added',
        addedAt: '2026-11-07T12:00:00.000Z',
        lastSeenAt: '2026-11-07T12:00:00.000Z',
        sources: [{ kind: 'integration', integration: { uuid: OWNER_INTEGRATION.uuid, label: OWNER_INTEGRATION.label } }],
        accessIntegration: { uuid: OWNER_INTEGRATION.uuid, label: OWNER_INTEGRATION.label },
      });
      expectNoForbiddenKeys(response.body);
    });

    it('resolves a case-variant fullName and re-checks with the stored githubId', async () => {
      ctx.github.script(OWNER_INTEGRATION.id, 'getRepository', '*', repository(KERGHAN));

      await add({ fullName: 'DarthJee/KERGHAN' }).expect(200);

      expect(ctx.github.githubCalls()).toEqual([
        { operation: 'getRepository', userId: ctx.ids.owner, integrationId: OWNER_INTEGRATION.id, page: SHARED_GITHUB_ID },
      ]);
    });

    it.each([
      ['not found', notFound()],
      ['forbidden', forbidden()],
    ])('answers 404 with the same body when every candidate denies (%s), writing nothing', async (_label, answer) => {
      ctx.github.script(OWNER_INTEGRATION.id, 'getRepository', '*', answer);

      const denied = await add({ githubId: SHARED_GITHUB_ID });
      const missing = await add({ githubId: MISSING_GITHUB_ID });

      expectErrorBody(denied, { status: 404, code: 'NOT_FOUND', message: 'Repository not found' });
      expect(withoutTimestamp(denied.body)).toEqual(withoutTimestamp(missing.body));
      expect(ctx.repositories.callsOf('markAdded')).toEqual([]);
    });

    it('answers 409 REPOSITORY_SOURCE_UNUSABLE with no GitHub call when no candidate is usable', async () => {
      ctx.github.setUsable(ctx.ids.owner, []);

      const response = await add({ githubId: SHARED_GITHUB_ID });

      expectErrorBody(response, {
        status: 409,
        code: 'REPOSITORY_SOURCE_UNUSABLE',
        message: 'The integration that sees this repository needs attention.',
      });
      expect(ctx.github.githubCalls()).toEqual([]);
      expect(ctx.repositories.callsOf('markAdded')).toEqual([]);
    });

    it('answers 503 GITHUB_RATE_LIMITED with Retry-After when the reset is known', async () => {
      ctx.github.script(OWNER_INTEGRATION.id, 'getRepository', '*', rateLimited(new Date(ctx.clock.now().getTime() + 45_000)));

      const response = await add({ githubId: SHARED_GITHUB_ID });

      expectErrorBody(response, { status: 503, code: 'GITHUB_RATE_LIMITED' });
      expect(response.headers['retry-after']).toBe('45');
      expect(response.body.error.retryAfterSeconds).toBe(45);
    });

    it('answers 503 GITHUB_RATE_LIMITED without Retry-After on a low budget (no reset known)', async () => {
      ctx.github.script(OWNER_INTEGRATION.id, 'getRepository', '*', { kind: 'rate_limited', resetAt: null });

      const response = await add({ githubId: SHARED_GITHUB_ID });

      expectErrorBody(response, { status: 503, code: 'GITHUB_RATE_LIMITED' });
      expect(response.headers['retry-after']).toBeUndefined();
    });

    it.each([
      ['timeout', timeout()],
      ['5xx', serverError()],
      ['redirect', redirect()],
    ])('answers 502 GITHUB_UNAVAILABLE on a %s', async (_label, answer) => {
      ctx.github.script(OWNER_INTEGRATION.id, 'getRepository', '*', answer);

      expectErrorBody(await add({ githubId: SHARED_GITHUB_ID }), {
        status: 502,
        code: 'GITHUB_UNAVAILABLE',
        message: 'GitHub is unavailable; try again later',
      });
      expect(ctx.repositories.callsOf('markAdded')).toEqual([]);
    });
  });

  describe('rate limit', () => {
    it('answers the 31st Add in the window with 429 REPOSITORY_ADD_RATE_LIMITED, then reopens', async () => {
      for (let i = 0; i < 30; i += 1) {
        expect((await add({ githubId: MISSING_GITHUB_ID })).status).toBe(404);
      }

      ctx.clock.advance(20_000);
      const refused = await add({ githubId: MISSING_GITHUB_ID });

      expectErrorBody(refused, {
        status: 429,
        code: 'REPOSITORY_ADD_RATE_LIMITED',
        message: 'Too many repositories added; try again later',
      });
      expect(refused.headers['retry-after']).toBe('40');
      expect(refused.headers['x-skip-cache']).toBe('true');
      expect(ctx.repositories.callsOf('findByRef')).toHaveLength(30);

      ctx.clock.advance(40_000);
      expect((await add({ githubId: MISSING_GITHUB_ID })).status).toBe(404);
    });

    it('counts per user: the intruder is unaffected', async () => {
      for (let i = 0; i < 30; i += 1) await add({ githubId: MISSING_GITHUB_ID });

      expect((await add({ githubId: MISSING_GITHUB_ID })).status).toBe(429);
      expect((await add({ githubId: MISSING_GITHUB_ID }, ctx.intruder)).status).toBe(404);
    });
  });
});

describe('POST /repositories/add.json rate-limit env overrides (e2e)', () => {
  const { ctx } = useRepositoriesTestApp({
    KERGHAN_REPOSITORIES_ADD_MAX_PER_WINDOW: '2',
    KERGHAN_REPOSITORIES_ADD_WINDOW_MS: '10000',
  });

  it('applies the configured max and window', async () => {
    const add = () => call(ctx.app, 'post', '/repositories/add.json', ctx.owner).send({ githubId: MISSING_GITHUB_ID });

    expect((await add()).status).toBe(404);
    expect((await add()).status).toBe(404);

    const refused = await add();

    expect(refused.status).toBe(429);
    expect(refused.headers['retry-after']).toBe('10');

    ctx.clock.advance(10_000);
    expect((await add()).status).toBe(404);
  });
});
