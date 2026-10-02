import { randomUUID } from 'node:crypto';
import { inspect } from 'node:util';
import request from 'supertest';
import {
  call,
  CANARY_OAUTH_CLIENT_SECRET,
  createIntegration,
  expectSafeBody,
  IntegrationsTestContext,
  TEST_OAUTH_CALLBACK_URL,
  TEST_OAUTH_CLIENT_ID,
  useIntegrationsTestApp,
} from './support/build-integrations-test-app.js';
import {
  CANARY_OAUTH_TOKEN,
  githubUserResponse,
  oauthExchangeResponse,
} from './support/fake-github-client.js';
import { CANARY_FRAGMENT, CANARY_FINE } from './support/integrations-harness.js';
import { expectErrorBody, expectValidationErrorBody } from '../../auth/tests/support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { GithubClientError } from '../github-client.service.js';
import { IntegrationsEncryptionService } from '../integrations-encryption.service.js';
import { Secret } from '../secret.js';

const START = '/integrations/oauth_app/start.json';
const CALLBACK = '/integrations/oauth_app/callback.json';
const CANARY_CODE = 'CANARYcanaryCODE0123';
const CANARY_NEW_TOKEN = 'gho_CANARYcanaryNEW0000000000000000000n3w4';
const MISSING = '00000000-0000-4000-8000-000000000000';
const CANARY_STATE = `${MISSING}.CANARYcanarySTATE${'0'.repeat(26)}`;

/**
 * `POST /integrations/oauth_app/start.json`.
 * @param {IntegrationsTestContext} ctx - The context.
 * @param {string | undefined} cookie - The caller's cookie.
 * @param {object} body - The body.
 * @returns {request.Test} The pending request.
 */
function start(ctx: IntegrationsTestContext, cookie: string | undefined, body: object): request.Test {
  return call(ctx.app, 'post', START, cookie).send(body);
}

/**
 * `POST /integrations/oauth_app/callback.json`.
 * @param {IntegrationsTestContext} ctx - The context.
 * @param {string | undefined} cookie - The caller's cookie.
 * @param {object} body - The body.
 * @returns {request.Test} The pending request.
 */
function callback(ctx: IntegrationsTestContext, cookie: string | undefined, body: object): request.Test {
  return call(ctx.app, 'post', CALLBACK, cookie).send(body);
}

/**
 * Starts a flow as the owner and returns its `state`.
 * @param {IntegrationsTestContext} ctx - The context.
 * @param {object} body - The start body.
 * @returns {Promise<string>} The `state`.
 */
async function startState(ctx: IntegrationsTestContext, body: object): Promise<string> {
  const response = await start(ctx, ctx.owner, body).expect(200);

  return new URL(response.body.authorizeUrl).searchParams.get('state') as string;
}

/**
 * Connects an `oauth_app` integration as the owner, through both routes.
 * @param {IntegrationsTestContext} ctx - The context.
 * @param {string} label - The label.
 * @returns {Promise<string>} The integration's id.
 */
async function connect(ctx: IntegrationsTestContext, label = 'Work'): Promise<string> {
  const state = await startState(ctx, { label });
  const response = await callback(ctx, ctx.owner, { code: CANARY_CODE, state }).expect(201);

  ctx.github.reset();

  return response.body.id;
}

/**
 * Asserts a response carries no canary.
 * @param {request.Response} response - The response.
 * @returns {void}
 */
function expectNoCanary(response: request.Response): void {
  expect(JSON.stringify(response.body)).not.toContain(CANARY_FRAGMENT);
  expect(JSON.stringify(response.headers)).not.toContain(CANARY_FRAGMENT);
}

describe('OauthAppController (e2e), type enabled', () => {
  const { ctx } = useIntegrationsTestApp({ oauthApp: true });

  afterEach(() => {
    expect(JSON.stringify(ctx.repo.rows.map((row) => [row.metadata, row.secretHint]))).not.toMatch(/CANARYcanary|e5f6.+e5f6/);
  });

  describe('happy path', () => {
    it('lists oauth_app in types.json, after pat', async () => {
      const response = await call(ctx.app, 'post', '/integrations/types.json', ctx.owner).expect(200);

      expect(response.body.types).toEqual([
        { type: 'pat', flows: { credentialPaste: true, redirect: false } },
        { type: 'oauth_app', flows: { credentialPaste: false, redirect: true } },
      ]);
    });

    it('starts a create flow and answers the authorize URL, without a GitHub call', async () => {
      const response = await start(ctx, ctx.owner, { label: 'Work' }).expect(200);
      const url = new URL(response.body.authorizeUrl);

      expect(Object.keys(response.body)).toEqual(['authorizeUrl']);
      expect(response.body.authorizeUrl.startsWith('https://github.com/login/oauth/authorize?')).toBe(true);
      expect(Object.fromEntries(url.searchParams)).toMatchObject({
        client_id: TEST_OAUTH_CLIENT_ID,
        redirect_uri: TEST_OAUTH_CALLBACK_URL,
        scope: 'repo',
        code_challenge_method: 'S256',
        allow_signup: 'false',
        prompt: 'select_account',
      });
      expect(ctx.github.totalCallCount).toBe(0);
      expectNoCanary(response);
    });

    it('creates an active integration on callback (201)', async () => {
      const state = await startState(ctx, { label: 'Work' });

      const response = await callback(ctx, ctx.owner, { code: CANARY_CODE, state }).expect(201);

      expect(response.body).toMatchObject({
        type: 'oauth_app',
        provider: 'github',
        label: 'Work',
        status: 'active',
        statusReason: null,
        githubLogin: 'octocat',
        secretHint: 'gho_…e5f6',
        expiresAt: null,
        metadata: { scopes: ['read:org', 'repo'], clientId: TEST_OAUTH_CLIENT_ID },
        lastTestResult: 'success',
      });
      expect(ctx.github.exchangeCalls[0].redirectUri).toBe(TEST_OAUTH_CALLBACK_URL);
      expect(ctx.github.exchangeCalls[0].clientSecret.reveal()).toBe(CANARY_OAUTH_CLIENT_SECRET);
      expectSafeBody(response.body);
    });

    it('replaces the credential on callback (200) and revokes the previous token', async () => {
      const id = await connect(ctx);
      const state = await startState(ctx, { integrationId: id });
      ctx.github.exchangeRespondWith(oauthExchangeResponse({ accessToken: new Secret(CANARY_NEW_TOKEN) }));

      const response = await callback(ctx, ctx.owner, { code: CANARY_CODE, state }).expect(200);

      expect(response.body).toMatchObject({ id, status: 'active', secretHint: 'gho_…n3w4' });
      expect(ctx.github.revokedTokens).toEqual([CANARY_OAUTH_TOKEN]);
      expect(ctx.github.revokeCalls[0].clientId).toBe(TEST_OAUTH_CLIENT_ID);
      expectSafeBody(response.body);
    });

    it('matches the literal oauth_app paths, not the generic :uuid routes', async () => {
      await start(ctx, ctx.owner, { label: 'Work' }).expect(200);
      expectErrorBody(await call(ctx.app, 'post', '/integrations/oauth_app/show.json', ctx.owner).send({}), {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Integration not found',
      });
    });
  });

  describe('start validation and checks', () => {
    it.each([
      ['both', { label: 'Work', integrationId: MISSING }],
      ['neither', {}],
    ])('answers 400 VALIDATION_FAILED with %s of label and integrationId', async (_label, body) => {
      expectValidationErrorBody(await start(ctx, ctx.owner, body));
      expect(ctx.oauthStates.rows).toHaveLength(0);
    });

    it.each([
      ['a blank label', { label: '   ' }],
      ['a malformed integrationId', { integrationId: 'nope' }],
    ])('answers 400 on %s', async (_label, body) => {
      expectValidationErrorBody(await start(ctx, ctx.owner, body));
    });

    it('answers 404 for another user\'s integrationId, and for an admin', async () => {
      const id = await connect(ctx);

      expectErrorBody(await start(ctx, ctx.intruder, { integrationId: id }), { status: 404, code: 'NOT_FOUND' });
      expectErrorBody(await start(ctx, ctx.admin, { integrationId: id }), { status: 404, code: 'NOT_FOUND' });
      expect(ctx.oauthStates.rows).toHaveLength(0);
    });

    it('answers 400 INTEGRATION_FLOW_UNSUPPORTED for a pat target', async () => {
      const id = (await createIntegration(ctx, ctx.owner)).body.id;

      expectErrorBody(await start(ctx, ctx.owner, { integrationId: id }), { status: 400, code: ErrorCodes.INTEGRATION_FLOW_UNSUPPORTED });
    });

    it('answers 423 during the cool-off and 409 on a duplicate label', async () => {
      await connect(ctx, 'Work');
      expectErrorBody(await start(ctx, ctx.owner, { label: 'work' }), { status: 409, code: ErrorCodes.INTEGRATION_LABEL_TAKEN });

      ctx.guard.state.set(ctx.userRepo.rows[0].id, { failedAttempts: 3, lockedUntil: new Date(Date.now() + 60000) });
      expectErrorBody(await start(ctx, ctx.owner, { label: 'Other' }), { status: 423, code: ErrorCodes.INTEGRATION_CREDENTIAL_LOCKED });
    });
  });

  describe('state', () => {
    it('answers the same 400 to a replay, without a GitHub call or a counted failure', async () => {
      const state = await startState(ctx, { label: 'Work' });
      await callback(ctx, ctx.owner, { code: CANARY_CODE, state }).expect(201);
      ctx.github.reset();

      const response = await callback(ctx, ctx.owner, { code: CANARY_CODE, state });

      expectErrorBody(response, { status: 400, code: ErrorCodes.INTEGRATION_REDIRECT_STATE_INVALID });
      expect(ctx.github.totalCallCount).toBe(0);
      expect(ctx.guard.state.get(ctx.userRepo.rows[0].id)?.failedAttempts ?? 0).toBe(0);
    });

    it.each([
      ['expired', async (): Promise<string> => {
        const state = await startState(ctx, { label: 'Work' });
        ctx.oauthStates.rows[0].expiresAt = new Date(Date.now() - 1000);
        return state;
      }],
      ['unknown', async (): Promise<string> => CANARY_STATE],
      ['wrong-secret', async (): Promise<string> => `${(await startState(ctx, { label: 'Work' })).split('.')[0]}.${CANARY_STATE.split('.')[1]}`],
    ])('answers the same 400 to an %s state', async (_label, makeState) => {
      const response = await callback(ctx, ctx.owner, { code: CANARY_CODE, state: await makeState() });

      expectErrorBody(response, { status: 400, code: ErrorCodes.INTEGRATION_REDIRECT_STATE_INVALID });
      expect(ctx.github.totalCallCount).toBe(0);
      expectNoCanary(response);
    });

    it('answers the same 400 to another user\'s state, leaving it usable', async () => {
      const state = await startState(ctx, { label: 'Work' });

      expectErrorBody(await callback(ctx, ctx.intruder, { code: CANARY_CODE, state }), {
        status: 400,
        code: ErrorCodes.INTEGRATION_REDIRECT_STATE_INVALID,
      });
      expect(ctx.github.totalCallCount).toBe(0);
      await callback(ctx, ctx.owner, { code: CANARY_CODE, state }).expect(201);
    });

    it('makes a single code exchange for two parallel callbacks with one state', async () => {
      const state = await startState(ctx, { label: 'Work' });

      const statuses = (await Promise.all([
        callback(ctx, ctx.owner, { code: CANARY_CODE, state }),
        callback(ctx, ctx.owner, { code: CANARY_CODE, state }),
      ])).map((response) => response.status).sort();

      expect(statuses).toEqual([201, 400]);
      expect(ctx.github.exchangeCalls).toHaveLength(1);
    });

    it.each([
      ['a malformed state', { code: CANARY_CODE, state: 'CANARYcanary' }],
      ['a malformed code', { code: 'CANARYcanary code!', state: CANARY_STATE }],
      ['a missing code', { state: CANARY_STATE }],
    ])('answers 400 VALIDATION_FAILED on %s, never echoing the values', async (_label, body) => {
      const response = await callback(ctx, ctx.owner, body);

      expectValidationErrorBody(response);
      expectNoCanary(response);
    });
  });

  describe('callback error mapping', () => {
    it.each([
      ['bad_verification_code', (): unknown => ctx.github.exchangeRespondWith(oauthExchangeResponse({ accessToken: null, error: 'bad_verification_code' })), 422, ErrorCodes.INTEGRATION_CREDENTIAL_INVALID, 1, false],
      ['a 401 on GET /user', (): unknown => ctx.github.respondWith(githubUserResponse({ status: 401, login: null })), 422, ErrorCodes.INTEGRATION_CREDENTIAL_INVALID, 1, true],
      ['no repo scope', (): unknown => ctx.github.respondWith(githubUserResponse({ oauthScopes: 'gist' })), 422, ErrorCodes.INTEGRATION_INSUFFICIENT_PERMISSIONS, 1, true],
      ['another exchange error', (): unknown => ctx.github.exchangeRespondWith(oauthExchangeResponse({ accessToken: null, error: 'incorrect_client_credentials' })), 502, ErrorCodes.GITHUB_UNAVAILABLE, 0, false],
      ['a 5xx on GET /user', (): unknown => ctx.github.respondWith(githubUserResponse({ status: 503, login: null })), 502, ErrorCodes.GITHUB_UNAVAILABLE, 0, true],
      ['a network error on the exchange', (): unknown => ctx.github.exchangeRespondWith(new GithubClientError('network_error')), 502, ErrorCodes.GITHUB_UNAVAILABLE, 0, false],
    ])('maps %s', async (_label, script, status, code, counted, revoked) => {
      const state = await startState(ctx, { label: 'Work' });
      script();

      const response = await callback(ctx, ctx.owner, { code: CANARY_CODE, state });

      expectErrorBody(response, { status, code });
      expect(ctx.guard.state.get(ctx.userRepo.rows[0].id)?.failedAttempts ?? 0).toBe(counted);
      expect(ctx.github.revokedTokens).toEqual(revoked ? [CANARY_OAUTH_TOKEN] : []);
      expect(ctx.repo.rows).toHaveLength(0);
      expectNoCanary(response);
    });

    it('answers a rate limit with 503 GITHUB_RATE_LIMITED and Retry-After', async () => {
      const state = await startState(ctx, { label: 'Work' });
      ctx.github.exchangeRespondWith(oauthExchangeResponse({ status: 429, accessToken: null, retryAfter: 61 }));

      const response = await callback(ctx, ctx.owner, { code: CANARY_CODE, state });

      expectErrorBody(response, { status: 503, code: ErrorCodes.GITHUB_RATE_LIMITED });
      expect(response.headers['retry-after']).toBe('61');
    });
  });

  describe('generic routes', () => {
    it('reject creating an oauth_app integration from a pasted credential', async () => {
      const response = await createIntegration(ctx, ctx.owner, { type: 'oauth_app', credential: { token: CANARY_OAUTH_TOKEN } });

      expectErrorBody(response, { status: 400, code: ErrorCodes.INTEGRATION_FLOW_UNSUPPORTED });
    });

    it('reject replacing an oauth_app credential by paste', async () => {
      const id = await connect(ctx);

      const response = await call(ctx.app, 'post', `/integrations/${id}/credential.json`, ctx.owner)
        .send({ credential: { token: CANARY_FINE } });

      expectErrorBody(response, { status: 400, code: ErrorCodes.INTEGRATION_FLOW_UNSUPPORTED });
    });
  });

  describe('access, caching and CSRF', () => {
    it.each([[START], [CALLBACK]])('answers 401 to an unauthenticated POST %s', async (path) => {
      expectErrorBody(await call(ctx.app, 'post', path).send({}), { status: 401, code: 'UNAUTHORIZED' });
    });

    it.each([
      [START, { label: 'Work' }, 200],
      [CALLBACK, { code: CANARY_CODE, state: CANARY_STATE }, 400],
    ])('marks POST %s as never cached', async (path, body, status) => {
      const response = await call(ctx.app, 'post', path, ctx.owner).send(body).expect(status);

      expect(response.headers['x-skip-cache']).toBe('true');
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it.each([
      [START, { label: 'Work' }],
      [CALLBACK, { code: CANARY_CODE, state: CANARY_STATE }],
    ])('rejects a cross-site POST %s with 403', async (path, body) => {
      const response = await call(ctx.app, 'post', path, ctx.owner)
        .set({ 'Sec-Fetch-Site': 'cross-site', Origin: 'https://evil.example' })
        .send(body);

      expectErrorBody(response, { status: 403, code: ErrorCodes.FORBIDDEN });
      expect(ctx.oauthStates.rows).toHaveLength(0);
      expect(ctx.github.totalCallCount).toBe(0);
    });
  });
});

describe('OauthAppController (e2e), type disabled', () => {
  const { ctx, spies } = useIntegrationsTestApp();
  let id: string;

  beforeEach(async () => {
    const encryption = ctx.app.get(IntegrationsEncryptionService);
    const uuid = randomUUID();
    const sealed = encryption.encrypt(new Secret({ token: CANARY_OAUTH_TOKEN }), { uuid, type: 'oauth_app' });

    await ctx.repo.save(ctx.repo.create({
      uuid,
      userId: ctx.userRepo.rows[0].id,
      provider: 'github',
      type: 'oauth_app',
      label: 'Old',
      labelNormalized: 'old',
      status: 'active',
      statusReason: null,
      githubLogin: 'octocat',
      expiresAt: null,
      lastTestedAt: null,
      lastTestResult: null,
      metadata: { scopes: ['repo'], clientId: TEST_OAUTH_CLIENT_ID },
      secretHint: 'gho_…e5f6',
      secretKeyId: sealed.keyId,
      secretIv: sealed.iv,
      secretAuthTag: sealed.authTag,
      secretCiphertext: sealed.ciphertext,
    }));
    id = uuid;
  });

  it.each([
    [START, { label: 'Work' }],
    [CALLBACK, { code: CANARY_CODE, state: CANARY_STATE }],
  ])('answers 404 NOT_FOUND to POST %s, before body validation', async (path, body) => {
    expectErrorBody(await call(ctx.app, 'post', path, ctx.owner).send(body), { status: 404, code: 'NOT_FOUND' });
    expectErrorBody(await call(ctx.app, 'post', path, ctx.owner).send({ junk: true }), { status: 404, code: 'NOT_FOUND' });
    expect(ctx.oauthStates.rows).toHaveLength(0);
    expect(ctx.github.totalCallCount).toBe(0);
  });

  it('still requires authentication first', async () => {
    expectErrorBody(await call(ctx.app, 'post', START).send({}), { status: 401, code: 'UNAUTHORIZED' });
  });

  it('omits oauth_app from types.json', async () => {
    const response = await call(ctx.app, 'post', '/integrations/types.json', ctx.owner).expect(200);

    expect(response.body.types.map(({ type }: { type: string }) => type)).toEqual(['pat']);
  });

  it('still renames and tests an existing oauth_app row', async () => {
    await call(ctx.app, 'patch', `/integrations/${id}.json`, ctx.owner).send({ label: 'Renamed' }).expect(200);
    ctx.github.respondWith(githubUserResponse({ status: 401, login: null }));

    const response = await call(ctx.app, 'post', `/integrations/${id}/test.json`, ctx.owner).expect(200);

    expect(response.body).toMatchObject({ label: 'Renamed', status: 'invalid', statusReason: 'revoked' });
  });

  it('deletes an existing oauth_app row without any GitHub call', async () => {
    await call(ctx.app, 'delete', `/integrations/${id}.json`, ctx.owner).expect(204);

    expect(ctx.repo.rows).toHaveLength(0);
    expect(ctx.github.totalCallCount).toBe(0);
    expect(inspect(spies.info.mock.calls, { depth: 10 })).toContain('type_disabled');
  });
});
