import { randomUUID } from 'node:crypto';
import { inspect } from 'node:util';
import request from 'supertest';
import {
  call,
  createIntegration,
  expectSafeBody,
  IntegrationsTestContext,
  useIntegrationsTestApp,
} from './support/build-integrations-test-app.js';
import {
  appInstallationResponse,
  CANARY_USER_TOKEN,
  githubAppExchangeResponse,
  installationsPage,
  installationTokenResponse,
} from './support/fake-github-client.js';
import { entry } from './support/github-app-flow-helpers.js';
import { CANARY_APP_CLIENT_SECRET, TEST_APP_CLIENT_ID } from './support/github-app-test-config.js';
import { githubAppTestKey } from './support/github-app-test-key.js';
import { CANARY_FINE, CANARY_FRAGMENT } from './support/integrations-harness.js';
import { expectErrorBody, expectValidationErrorBody } from '../../auth/tests/support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { IntegrationsEncryptionService } from '../integrations-encryption.service.js';
import { Secret } from '../secret.js';

const START = '/integrations/github_app/start.json';
const CALLBACK = '/integrations/github_app/callback.json';
const SELECT = '/integrations/github_app/select.json';
const CANARY_CODE = 'CANARYcanaryCODE0123';
const MISSING = '00000000-0000-4000-8000-000000000000';
const CANARY_STATE = `${MISSING}.CANARYcanarySTATE${'0'.repeat(26)}`;
const INSTALL = { installationId: 12345678, setupAction: 'install' };

/**
 * POSTs a body to a GitHub App route.
 * @param {IntegrationsTestContext} ctx - The context.
 * @param {string} path - The route.
 * @param {string | undefined} cookie - The caller's cookie.
 * @param {object} body - The body.
 * @returns {request.Test} The pending request.
 */
function post(ctx: IntegrationsTestContext, path: string, cookie: string | undefined, body: object): request.Test {
  return call(ctx.app, 'post', path, cookie).send(body);
}

/**
 * Clears the fake client, keeping the GitHub App's `ghu_` exchange default.
 * @param {IntegrationsTestContext} ctx - The context.
 */
function resetGithub(ctx: IntegrationsTestContext): void {
  ctx.github.reset();
  ctx.github.exchangeRespondByDefault(githubAppExchangeResponse());
}

/**
 * Starts a flow as a user and returns its `state`.
 * @param {IntegrationsTestContext} ctx - The context.
 * @param {object} body - The start body.
 * @param {string} [cookie] - The caller's cookie (the owner by default).
 * @returns {Promise<string>} The `state`.
 */
async function startState(ctx: IntegrationsTestContext, body: object, cookie = ctx.owner): Promise<string> {
  const response = await post(ctx, START, cookie, body).expect(200);

  return new URL(response.body.redirectUrl).searchParams.get('state') as string;
}

/**
 * Connects a `github_app` integration as the owner, through start and callback.
 * @param {IntegrationsTestContext} ctx - The context.
 * @param {string} [label] - The label.
 * @returns {Promise<string>} The integration's id.
 */
async function connect(ctx: IntegrationsTestContext, label = 'Work'): Promise<string> {
  const state = await startState(ctx, { label });
  const response = await post(ctx, CALLBACK, ctx.owner, { code: CANARY_CODE, state, ...INSTALL }).expect(201);

  resetGithub(ctx);

  return response.body.id;
}

/**
 * Asserts a response carries no canary, JWT or key material.
 * @param {request.Response} response - The response.
 */
function expectNoSecrets(response: request.Response): void {
  const text = `${JSON.stringify(response.body)} ${JSON.stringify(response.headers)}`;

  expect(text).not.toContain(CANARY_FRAGMENT);
  expect(text).not.toContain('eyJ');
  expect(text).not.toContain(githubAppTestKey().base64Pem.slice(0, 40));
}

const failuresOf = (ctx: IntegrationsTestContext): number => ctx.guard.state.get(ctx.userRepo.rows[0].id)?.failedAttempts ?? 0;

describe('GithubAppController (e2e), type enabled', () => {
  const { ctx, spies } = useIntegrationsTestApp({ githubApp: true });

  afterEach(() => {
    const logged = inspect(Object.values(spies).flatMap((spy) => spy.mock.calls), { depth: 10 });

    expect(logged).not.toContain('eyJ');
    expect(logged).not.toContain('PRIVATE KEY');
    expect(JSON.stringify(ctx.repo.rows.map((row) => [row.metadata, row.secretHint]))).not.toContain(CANARY_FRAGMENT);
    expect(JSON.stringify(ctx.githubAppStates.rows)).not.toContain(CANARY_FRAGMENT);
  });

  describe('happy path', () => {
    it('lists github_app in types.json', async () => {
      const response = await call(ctx.app, 'post', '/integrations/types.json', ctx.owner).expect(200);

      expect(response.body.types).toContainEqual({ type: 'github_app', flows: { credentialPaste: false, redirect: true } });
    });

    it('answers the installation page URL (install, the default), without a GitHub call', async () => {
      const response = await post(ctx, START, ctx.owner, { label: 'Work' }).expect(200);

      expect(Object.keys(response.body)).toEqual(['redirectUrl']);
      expect(response.body.redirectUrl).toMatch(/^https:\/\/github\.com\/apps\/[a-z0-9-]+\/installations\/new\?/);
      expect(ctx.github.totalCallCount).toBe(0);
      expectNoSecrets(response);
    });

    it('answers the authorize URL in connect mode', async () => {
      const response = await post(ctx, START, ctx.owner, { label: 'Work', mode: 'connect' }).expect(200);
      const url = new URL(response.body.redirectUrl);

      expect(response.body.redirectUrl.startsWith('https://github.com/login/oauth/authorize?')).toBe(true);
      expect(url.searchParams.get('client_id')).toBe(TEST_APP_CLIENT_ID);
      expect(url.searchParams.get('redirect_uri')).toBe('https://kerghan.example.com/integrations/github_app/callback');
      expect(response.body.redirectUrl).not.toContain(CANARY_APP_CLIENT_SECRET);
    });

    it('creates an active integration on an install callback (201), revoking the user token', async () => {
      const state = await startState(ctx, { label: 'Work' });

      const response = await post(ctx, CALLBACK, ctx.owner, { code: CANARY_CODE, state, ...INSTALL }).expect(201);

      expect(response.body).toMatchObject({
        type: 'github_app',
        provider: 'github',
        label: 'Work',
        status: 'active',
        githubLogin: 'acme',
        secretHint: 'installation …5678',
        expiresAt: null,
        metadata: {
          installationId: 12345678,
          appId: 123456,
          accountLogin: 'acme',
          accountType: 'Organization',
          repositorySelection: 'selected',
          permissions: { issues: 'read', metadata: 'read' },
          verifiedBy: 'octocat',
        },
      });
      expect(ctx.github.revokedTokens).toEqual([CANARY_USER_TOKEN]);
      expect(ctx.github.revokeCalls[0].clientId).toBe(TEST_APP_CLIENT_ID);
      expect(ctx.github.exchangeCalls[0].codeVerifier).toBeUndefined();
      expectSafeBody(response.body);
      expectNoSecrets(response);
    });

    it('replaces on callback (200), without any call about the previous installation', async () => {
      const id = await connect(ctx);
      const state = await startState(ctx, { integrationId: id });

      const response = await post(ctx, CALLBACK, ctx.owner, { code: CANARY_CODE, state, ...INSTALL }).expect(200);

      expect(response.body).toMatchObject({ id, status: 'active' });
      expect(ctx.github.revokedTokens).toEqual([CANARY_USER_TOKEN]);
      expect(ctx.repo.rows).toHaveLength(1);
    });

    it('answers a selection (200) in connect mode, then select stores the choice (201)', async () => {
      const state = await startState(ctx, { label: 'Work', mode: 'connect' });
      ctx.github.installationsQueue.push(installationsPage({
        installations: [entry(23456789, 'octocat'), entry(12345678, 'acme'), entry(5, 'other', 777)],
      }));

      const selection = await post(ctx, CALLBACK, ctx.owner, { code: CANARY_CODE, state }).expect(200);

      expect(selection.body).toEqual({
        selection: {
          state: expect.stringMatching(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/),
          installations: [
            { installationId: 12345678, accountLogin: 'acme', accountType: 'Organization' },
            { installationId: 23456789, accountLogin: 'octocat', accountType: 'User' },
          ],
        },
      });
      expect(ctx.repo.rows).toHaveLength(0);

      ctx.github.appInstallationQueue.push(appInstallationResponse({ installationId: 23456789, accountLogin: 'octocat', accountType: 'User' }));
      const stored = await post(ctx, SELECT, ctx.owner, { state: selection.body.selection.state, installationId: 23456789 }).expect(201);

      expect(stored.body).toMatchObject({ githubLogin: 'octocat', secretHint: 'installation …6789', metadata: { verifiedBy: 'octocat' } });
      await post(ctx, SELECT, ctx.owner, { state: selection.body.selection.state, installationId: 23456789 }).expect(400);
    });
  });

  describe('validation', () => {
    it.each([
      ['both of label and integrationId', { label: 'Work', integrationId: MISSING }],
      ['neither of label and integrationId', {}],
      ['an unknown mode', { label: 'Work', mode: 'steal' }],
      ['a non-uuid integrationId', { integrationId: 'nope' }],
      ['a null label', { label: null }],
      ['a null integrationId', { integrationId: null }],
    ])('answers 400 VALIDATION_FAILED on start with %s', async (_label, body) => {
      const response = await post(ctx, START, ctx.owner, body);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(ErrorCodes.VALIDATION_FAILED);
      expect(ctx.githubAppStates.rows).toHaveLength(0);
    });

    it.each([
      ['a malformed code', { code: 'bad code!', state: CANARY_STATE }],
      ['a malformed state', { code: CANARY_CODE, state: 'CANARYcanary' }],
      ['an installationId without setupAction', { code: CANARY_CODE, state: CANARY_STATE, installationId: 1 }],
      ['a setupAction without installationId', { code: CANARY_CODE, state: CANARY_STATE, setupAction: 'install' }],
      ['a request setupAction', { code: CANARY_CODE, state: CANARY_STATE, installationId: 1, setupAction: 'request' }],
      ['a string installationId', { code: CANARY_CODE, state: CANARY_STATE, installationId: '1', setupAction: 'install' }],
      ['a zero installationId', { code: CANARY_CODE, state: CANARY_STATE, installationId: 0, setupAction: 'install' }],
      ['an unsafe installationId', { code: CANARY_CODE, state: CANARY_STATE, installationId: 2 ** 53, setupAction: 'install' }],
      ['a null installationId', { code: CANARY_CODE, state: CANARY_STATE, installationId: null, setupAction: 'install' }],
    ])('answers 400 VALIDATION_FAILED on callback with %s, never echoing code or state', async (_label, body) => {
      const response = await post(ctx, CALLBACK, ctx.owner, body);

      expectValidationErrorBody(response);
      expectNoSecrets(response);
      expect(ctx.github.totalCallCount).toBe(0);
    });

    it.each([
      ['no installationId', { state: CANARY_STATE }],
      ['a malformed state', { state: 'x', installationId: 1 }],
    ])('answers 400 VALIDATION_FAILED on select with %s', async (_label, body) => {
      expectValidationErrorBody(await post(ctx, SELECT, ctx.owner, body));
    });
  });

  describe('checks', () => {
    it('answers 404 for another user\'s integrationId, and for an admin', async () => {
      const id = await connect(ctx);

      expectErrorBody(await post(ctx, START, ctx.intruder, { integrationId: id }), { status: 404, code: 'NOT_FOUND' });
      expectErrorBody(await post(ctx, START, ctx.admin, { integrationId: id }), { status: 404, code: 'NOT_FOUND' });
    });

    it('answers 400 INTEGRATION_FLOW_UNSUPPORTED for a pat target', async () => {
      const pat = await createIntegration(ctx, ctx.owner, { label: 'Pat' });

      expectErrorBody(await post(ctx, START, ctx.owner, { integrationId: pat.body.id }), {
        status: 400, code: ErrorCodes.INTEGRATION_FLOW_UNSUPPORTED,
      });
    });

    it('answers 423 during the cool-off and 409 on a duplicate label', async () => {
      await connect(ctx, 'Work');

      expectErrorBody(await post(ctx, START, ctx.owner, { label: 'work' }), { status: 409, code: ErrorCodes.INTEGRATION_LABEL_TAKEN });
      ctx.guard.state.set(ctx.userRepo.rows[0].id, { failedAttempts: 3, lockedUntil: new Date(Date.now() + 60000) });
      expectErrorBody(await post(ctx, START, ctx.owner, { label: 'New' }), { status: 423, code: ErrorCodes.INTEGRATION_CREDENTIAL_LOCKED });
    });

    it('rejects a forged installation_id (422), counted, with no app-JWT call and nothing stored', async () => {
      const state = await startState(ctx, { label: 'Work' });

      const response = await post(ctx, CALLBACK, ctx.owner, { code: CANARY_CODE, state, installationId: 999, setupAction: 'install' });

      expectErrorBody(response, { status: 422, code: ErrorCodes.INTEGRATION_INSTALLATION_NOT_ACCESSIBLE });
      expect(failuresOf(ctx)).toBe(1);
      expect(ctx.github.appJwtCallCount).toBe(0);
      expect(ctx.repo.rows).toHaveLength(0);
      expect(ctx.github.revokedTokens).toEqual([CANARY_USER_TOKEN]);
    });

    it('locks the user out after repeated forged ids (423)', async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const state = await startState(ctx, { label: 'Work' });
        await post(ctx, CALLBACK, ctx.owner, { code: CANARY_CODE, state, installationId: 999 + attempt, setupAction: 'install' })
          .expect(422);
      }

      expectErrorBody(await post(ctx, START, ctx.owner, { label: 'Work' }), { status: 423, code: ErrorCodes.INTEGRATION_CREDENTIAL_LOCKED });
    });

    it('answers the same 400 to a replay, a select state on callback and another user\'s state, without GitHub calls', async () => {
      const state = await startState(ctx, { label: 'Work' });
      await post(ctx, CALLBACK, ctx.owner, { code: CANARY_CODE, state, ...INSTALL }).expect(201);
      resetGithub(ctx);
      const foreign = await startState(ctx, { label: 'Other' }, ctx.intruder);

      for (const value of [state, foreign, CANARY_STATE]) {
        const response = await post(ctx, CALLBACK, ctx.owner, { code: CANARY_CODE, state: value });

        expectErrorBody(response, { status: 400, code: ErrorCodes.INTEGRATION_REDIRECT_STATE_INVALID });
        expectNoSecrets(response);
      }

      expect(ctx.github.totalCallCount).toBe(0);
      expect(failuresOf(ctx)).toBe(0);
    });

    it('makes a single code exchange for two parallel callbacks with one state', async () => {
      const state = await startState(ctx, { label: 'Work' });

      const responses = await Promise.all([
        post(ctx, CALLBACK, ctx.owner, { code: CANARY_CODE, state, ...INSTALL }),
        post(ctx, CALLBACK, ctx.owner, { code: CANARY_CODE, state, ...INSTALL }),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([201, 400]);
      expect(ctx.github.exchangeCalls).toHaveLength(1);
    });

    it.each([
      ['suspended', () => ctx.github.appInstallationQueue.push(appInstallationResponse({ suspended: true })), 422, ErrorCodes.INTEGRATION_INSTALLATION_SUSPENDED],
      ['insufficient permissions', () => ctx.github.appInstallationQueue.push(appInstallationResponse({ permissions: { issues: 'read', metadata: null } })), 422, ErrorCodes.INTEGRATION_INSUFFICIENT_PERMISSIONS],
      ['bad code', () => ctx.github.exchangeRespondWith(githubAppExchangeResponse({ accessToken: null, error: 'bad_verification_code' })), 422, ErrorCodes.INTEGRATION_CREDENTIAL_INVALID],
      ['app misconfiguration', () => ctx.github.tokenQueue.push(installationTokenResponse({ status: 401 })), 502, ErrorCodes.GITHUB_UNAVAILABLE],
    ])('maps %s', async (_label, script, status, code) => {
      const state = await startState(ctx, { label: 'Work' });
      script();

      const response = await post(ctx, CALLBACK, ctx.owner, { code: CANARY_CODE, state, ...INSTALL });

      expectErrorBody(response, { status, code });
      expectNoSecrets(response);
    });

    it('answers a rate limit with 503 GITHUB_RATE_LIMITED and Retry-After', async () => {
      const state = await startState(ctx, { label: 'Work' });
      ctx.github.appInstallationQueue.push(appInstallationResponse({}, { status: 403, installation: null, retryAfter: 61 }));

      const response = await post(ctx, CALLBACK, ctx.owner, { code: CANARY_CODE, state, ...INSTALL });

      expectErrorBody(response, { status: 503, code: ErrorCodes.GITHUB_RATE_LIMITED });
      expect(response.headers['retry-after']).toBe('61');
    });
  });

  describe('generic routes', () => {
    it('reject creating a github_app integration from a pasted credential', async () => {
      expectErrorBody(await createIntegration(ctx, ctx.owner, { type: 'github_app', credential: { installationId: 1 } }), {
        status: 400, code: ErrorCodes.INTEGRATION_FLOW_UNSUPPORTED,
      });
    });

    it('reject replacing a github_app credential by paste', async () => {
      const id = await connect(ctx);

      expectErrorBody(await call(ctx.app, 'post', `/integrations/${id}/credential.json`, ctx.owner).send({ credential: { token: CANARY_FINE } }), {
        status: 400, code: ErrorCodes.INTEGRATION_FLOW_UNSUPPORTED,
      });
    });

    it('tests a github_app row, keeping verifiedBy', async () => {
      const id = await connect(ctx);
      ctx.repo.rows[0].lastTestedAt = null;
      ctx.github.appInstallationQueue.push(appInstallationResponse({ accountLogin: 'acme-renamed' }));

      const response = await call(ctx.app, 'post', `/integrations/${id}/test.json`, ctx.owner).expect(200);

      expect(response.body).toMatchObject({ status: 'active', githubLogin: 'acme-renamed', metadata: { verifiedBy: 'octocat' } });
    });

    it('deletes a github_app row without any GitHub call', async () => {
      const id = await connect(ctx);

      await call(ctx.app, 'delete', `/integrations/${id}.json`, ctx.owner).expect(204);

      expect(ctx.repo.rows).toHaveLength(0);
      expect(ctx.github.totalCallCount).toBe(0);
    });
  });

  describe('access, caching and CSRF', () => {
    it.each([[START], [CALLBACK], [SELECT]])('answers 401 to an unauthenticated POST %s', async (path) => {
      expectErrorBody(await call(ctx.app, 'post', path).send({}), { status: 401, code: 'UNAUTHORIZED' });
    });

    it.each([
      [START, { label: 'Work' }, 200],
      [CALLBACK, { code: CANARY_CODE, state: CANARY_STATE }, 400],
      [SELECT, { state: CANARY_STATE, installationId: 1 }, 400],
    ])('marks POST %s as never cached', async (path, body, status) => {
      const response = await post(ctx, path, ctx.owner, body).expect(status);

      expect(response.headers['x-skip-cache']).toBe('true');
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it.each([
      [START, { label: 'Work' }],
      [CALLBACK, { code: CANARY_CODE, state: CANARY_STATE }],
      [SELECT, { state: CANARY_STATE, installationId: 1 }],
    ])('rejects a cross-site POST %s with 403', async (path, body) => {
      const response = await post(ctx, path, ctx.owner, body).set({ 'Sec-Fetch-Site': 'cross-site', Origin: 'https://evil.example' });

      expectErrorBody(response, { status: 403, code: ErrorCodes.FORBIDDEN });
      expect(ctx.githubAppStates.rows).toHaveLength(0);
      expect(ctx.github.totalCallCount).toBe(0);
    });
  });
});

describe('GithubAppController (e2e), type disabled', () => {
  const { ctx } = useIntegrationsTestApp();
  let id: string;

  beforeEach(async () => {
    const encryption = ctx.app.get(IntegrationsEncryptionService);
    const uuid = randomUUID();
    const sealed = encryption.encrypt(new Secret({ installationId: 12345678 }), { uuid, type: 'github_app' });

    await ctx.repo.save(ctx.repo.create({
      uuid,
      userId: ctx.userRepo.rows[0].id,
      provider: 'github',
      type: 'github_app',
      label: 'Old',
      labelNormalized: 'old',
      status: 'active',
      statusReason: null,
      githubLogin: 'acme',
      expiresAt: null,
      lastTestedAt: null,
      lastTestResult: null,
      metadata: {
        installationId: 12345678,
        appId: 123456,
        accountLogin: 'acme',
        accountType: 'Organization',
        repositorySelection: 'selected',
        permissions: { issues: 'read', metadata: 'read' },
        verifiedBy: 'octocat',
      },
      secretHint: 'installation …5678',
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
    [SELECT, { state: CANARY_STATE, installationId: 1 }],
  ])('answers 404 NOT_FOUND to POST %s, before body validation', async (path, body) => {
    expectErrorBody(await post(ctx, path, ctx.owner, body), { status: 404, code: 'NOT_FOUND' });
    expectErrorBody(await post(ctx, path, ctx.owner, { junk: true }), { status: 404, code: 'NOT_FOUND' });
    expect(ctx.githubAppStates.rows).toHaveLength(0);
    expect(ctx.github.totalCallCount).toBe(0);
  });

  it('still requires authentication first', async () => {
    expectErrorBody(await call(ctx.app, 'post', START).send({}), { status: 401, code: 'UNAUTHORIZED' });
  });

  it('omits github_app from types.json', async () => {
    const response = await call(ctx.app, 'post', '/integrations/types.json', ctx.owner).expect(200);

    expect(response.body.types.map(({ type }: { type: string }) => type)).not.toContain('github_app');
  });

  it('renames an existing row, and answers 502 to a test without any GitHub call', async () => {
    await call(ctx.app, 'patch', `/integrations/${id}.json`, ctx.owner).send({ label: 'Renamed' }).expect(200);

    expectErrorBody(await call(ctx.app, 'post', `/integrations/${id}/test.json`, ctx.owner), {
      status: 502, code: ErrorCodes.GITHUB_UNAVAILABLE,
    });
    expect(ctx.github.totalCallCount).toBe(0);
    expect(ctx.repo.rows[0]).toMatchObject({ label: 'Renamed', status: 'active' });
  });

  it('deletes an existing row without any GitHub call', async () => {
    await call(ctx.app, 'delete', `/integrations/${id}.json`, ctx.owner).expect(204);

    expect(ctx.repo.rows).toHaveLength(0);
    expect(ctx.github.totalCallCount).toBe(0);
  });
});
