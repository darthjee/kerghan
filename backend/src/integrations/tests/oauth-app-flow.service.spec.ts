import { createHash } from 'node:crypto';
import { inspect } from 'node:util';
import { HttpException } from '@nestjs/common';
import { CANARY_OAUTH_TOKEN, githubUserResponse, oauthExchangeResponse } from './support/fake-github-client.js';
import { createInMemoryOauthStateRepo, InMemoryOauthStateRepo } from './support/in-memory-oauth-states.js';
import { buildIntegrationsHarness, CANARY_CLASSIC, CANARY_FRAGMENT, IntegrationsHarness } from './support/integrations-harness.js';
import { ErrorCodes } from '../../core/error-codes.js';
import type { LoggerService } from '../../core/logger.service.js';
import type { GithubClientService } from '../github-client.service.js';
import { Secret } from '../secret.js';
import { OauthAppCodeExchangeService } from '../types/oauth-app/oauth-app-code-exchange.service.js';
import { OauthAppConfig } from '../types/oauth-app/oauth-app-config.js';
import { OauthAppFlowService } from '../types/oauth-app/oauth-app-flow.service.js';
import { OauthAppRevocationService } from '../types/oauth-app/oauth-app-revocation.service.js';
import { OauthAppStrategy } from '../types/oauth-app/oauth-app.strategy.js';
import { OauthStateService } from '../types/oauth-app/oauth-state.service.js';

const OWNER = 1;
const INTRUDER = 2;
const CLIENT_ID = 'Ov23liAbCdEf01234567';
const CANARY_CLIENT_SECRET = 'CANARYcanarySECRET0123456789abcdef012345';
const CANARY_CODE = 'CANARYcanaryCODE0123';
const CANARY_NEW_TOKEN = 'gho_CANARYcanaryNEW0000000000000000000n3w4';
const CALLBACK_URL = 'https://kerghan.example.com/integrations/oauth_app/callback';
const MISSING_UUID = '0b6c1f8e-3a52-4c1b-9d5a-6f2e7c8d9a10';

const ENABLED: OauthAppConfig = {
  enabled: true,
  clientId: CLIENT_ID,
  clientSecret: new Secret(CANARY_CLIENT_SECRET),
  callbackUrl: CALLBACK_URL,
};

interface FlowHarness extends IntegrationsHarness {
  flow: OauthAppFlowService;
  states: InMemoryOauthStateRepo;
}

/**
 * Wires the flow service over the shared harness and the in-memory state table.
 * @param {OauthAppConfig} config - The server config.
 * @param {number} [maxPerUser] - The per-user cap.
 * @returns {FlowHarness} The flow and its collaborators.
 */
function buildFlow(config: OauthAppConfig = ENABLED, maxPerUser?: number): FlowHarness {
  const harness = buildIntegrationsHarness({ maxPerUser, maxAttempts: 3 });
  const client = harness.github as unknown as GithubClientService;
  const logger = harness.logger as unknown as LoggerService;
  const revocation = new OauthAppRevocationService(client, logger, config);
  const strategy = new OauthAppStrategy(
    client,
    new OauthAppCodeExchangeService(client, logger, revocation),
    revocation,
    config,
  );
  const states = createInMemoryOauthStateRepo();
  const flow = new OauthAppFlowService(
    strategy,
    new OauthStateService(states as never),
    harness.store,
    harness.credentials,
    harness.encryption,
    harness.service,
  );

  return { ...harness, flow, states };
}

/**
 * Captures what a call throws.
 * @param {Promise<unknown>} promise - The call.
 * @returns {Promise<HttpException>} The thrown exception.
 */
async function rejection(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    return error as HttpException;
  }

  throw new Error('expected the call to throw');
}

/**
 * Asserts an HTTP exception's status and code.
 * @param {HttpException} error - The exception.
 * @param {number} status - The expected status.
 * @param {string} code - The expected code (`NOT_FOUND` is checked by status only).
 * @returns {void}
 */
function expectHttp(error: HttpException, status: number, code?: string): void {
  expect(error).toBeInstanceOf(HttpException);
  expect(error.getStatus()).toBe(status);

  if (code !== undefined) {
    expect(error.getResponse()).toMatchObject({ code });
  }

  expect(inspect(error, { depth: 10 })).not.toContain(CANARY_FRAGMENT);
}

/**
 * Starts a flow and extracts the `state` from the authorize URL.
 * @param {FlowHarness} h - The harness.
 * @param {object} body - The start body.
 * @param {string} [body.label] - The label (create).
 * @param {string} [body.integrationId] - The target (replace).
 * @param {number} [userId] - The caller.
 * @returns {Promise<string>} The `state` value.
 */
async function startState(h: FlowHarness, body: { label?: string; integrationId?: string }, userId = OWNER): Promise<string> {
  const { authorizeUrl } = await h.flow.start(userId, body);

  return new URL(authorizeUrl).searchParams.get('state') as string;
}

/**
 * Creates an `oauth_app` integration through the whole flow.
 * @param {FlowHarness} h - The harness.
 * @param {string} label - The label.
 * @returns {Promise<string>} The new integration's uuid.
 */
async function connect(h: FlowHarness, label = 'Work'): Promise<string> {
  const state = await startState(h, { label });
  const { integration } = await h.flow.callback(OWNER, { code: CANARY_CODE, state });

  h.github.reset();

  return integration.id;
}

describe('OauthAppFlowService', () => {
  let h: FlowHarness;

  beforeEach(() => {
    h = buildFlow();
  });

  afterEach(() => {
    const logged = Object.values(h.logger).flatMap((mock) => mock.mock.calls);

    expect(inspect(logged, { depth: 10 })).not.toContain(CANARY_FRAGMENT);
    expect(JSON.stringify(h.repo.rows.map((row) => row.metadata))).not.toContain(CANARY_FRAGMENT);
  });

  describe('start', () => {
    it('answers the authorize URL with every parameter, and a challenge matching the stored verifier', async () => {
      const { authorizeUrl } = await h.flow.start(OWNER, { label: 'Work' });
      const url = new URL(authorizeUrl);

      expect(authorizeUrl.startsWith('https://github.com/login/oauth/authorize?')).toBe(true);
      expect(Object.fromEntries(url.searchParams)).toEqual({
        client_id: CLIENT_ID,
        redirect_uri: CALLBACK_URL,
        scope: 'repo',
        state: expect.stringMatching(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/),
        code_challenge: createHash('sha256').update(h.states.rows[0].codeVerifier).digest('base64url'),
        code_challenge_method: 'S256',
        allow_signup: 'false',
        prompt: 'select_account',
      });
      expect(authorizeUrl).not.toContain(CANARY_CLIENT_SECRET);
      expect(h.states.rows[0]).toMatchObject({ userId: OWNER, purpose: 'create', label: 'Work' });
      expect(h.github.totalCallCount).toBe(0);
    });

    it('starts a replace for an owned oauth_app row', async () => {
      const uuid = await connect(h);

      await h.flow.start(OWNER, { integrationId: uuid });

      expect(h.states.rows[0]).toMatchObject({ purpose: 'replace', integrationUuid: uuid, label: null });
      expect(h.github.totalCallCount).toBe(0);
    });

    it.each([
      ['both', { label: 'Work', integrationId: MISSING_UUID }],
      ['neither', {}],
    ])('rejects %s of label and integrationId', async (_label, body) => {
      expectHttp(await rejection(h.flow.start(OWNER, body)), 400, ErrorCodes.VALIDATION_FAILED);
      expect(h.states.rows).toHaveLength(0);
    });

    it('answers 404 while disabled', async () => {
      const disabled = buildFlow({ enabled: false });

      expectHttp(await rejection(disabled.flow.start(OWNER, { label: 'Work' })), 404);
      expect(disabled.states.rows).toHaveLength(0);
    });

    it.each([
      ['missing', async (): Promise<string> => MISSING_UUID],
      ['foreign', async (harness: FlowHarness): Promise<string> => connect(harness)],
    ])('answers 404 for a %s target, even while locked out', async (_label, target) => {
      const uuid = await target(h);
      h.guard.state.set(INTRUDER, { failedAttempts: 3, lockedUntil: new Date(Date.now() + 60000) });

      expectHttp(await rejection(h.flow.start(INTRUDER, { integrationId: uuid })), 404);
      expect(h.states.rows).toHaveLength(0);
    });

    it('rejects a non-oauth_app target', async () => {
      const pat = await h.service.create(OWNER, { label: 'Pat', provider: 'github', type: 'pat', credential: { token: CANARY_CLASSIC } });

      expectHttp(await rejection(h.flow.start(OWNER, { integrationId: pat.id })), 400, ErrorCodes.INTEGRATION_FLOW_UNSUPPORTED);
    });

    it('answers 423 during the cool-off', async () => {
      h.guard.state.set(OWNER, { failedAttempts: 3, lockedUntil: new Date(Date.now() + 60000) });

      expectHttp(await rejection(h.flow.start(OWNER, { label: 'Work' })), 423, ErrorCodes.INTEGRATION_CREDENTIAL_LOCKED);
      expect(h.states.rows).toHaveLength(0);
    });

    it('answers 409 when the cap is reached', async () => {
      const capped = buildFlow(ENABLED, 1);
      await connect(capped, 'First');

      expectHttp(await rejection(capped.flow.start(OWNER, { label: 'Second' })), 409, ErrorCodes.INTEGRATIONS_LIMIT_REACHED);
      expect(capped.github.totalCallCount).toBe(0);
    });

    it('answers 409 for a duplicate label (case-insensitive)', async () => {
      await connect(h, 'Work');

      expectHttp(await rejection(h.flow.start(OWNER, { label: 'WORK' })), 409, ErrorCodes.INTEGRATION_LABEL_TAKEN);
    });
  });

  describe('callback', () => {
    it('creates an active row (created) with the hint, login, scopes, clientId and no expiry', async () => {
      const state = await startState(h, { label: 'Work' });

      const result = await h.flow.callback(OWNER, { code: CANARY_CODE, state });

      expect(result.created).toBe(true);
      expect(result.integration).toMatchObject({
        type: 'oauth_app',
        provider: 'github',
        label: 'Work',
        status: 'active',
        githubLogin: 'octocat',
        secretHint: 'gho_…e5f6',
        expiresAt: null,
        metadata: { scopes: ['read:org', 'repo'], clientId: CLIENT_ID },
      });
      expect(h.github.exchangeCalls[0].code.reveal()).toBe(CANARY_CODE);
      expect(h.github.exchangeCalls).toHaveLength(1);
      expect(h.states.rows).toHaveLength(0);
      expect(JSON.stringify(result)).not.toContain(CANARY_FRAGMENT);
    });

    it('replaces the credential (not created) and revokes the previous token', async () => {
      const uuid = await connect(h);
      const state = await startState(h, { integrationId: uuid });
      h.github.exchangeRespondWith(oauthExchangeResponse({ accessToken: new Secret(CANARY_NEW_TOKEN) }));
      h.github.respondWith(githubUserResponse({ login: 'hubot' }));

      const result = await h.flow.callback(OWNER, { code: CANARY_CODE, state });

      expect(result.created).toBe(false);
      expect(result.integration).toMatchObject({ id: uuid, githubLogin: 'hubot', secretHint: 'gho_…n3w4', status: 'active' });
      expect(h.github.revokedTokens).toEqual([CANARY_OAUTH_TOKEN]);
      expect(h.repo.rows).toHaveLength(1);
    });

    it('does not revoke the previous token when GitHub returned the same one', async () => {
      const uuid = await connect(h);
      const state = await startState(h, { integrationId: uuid });

      await h.flow.callback(OWNER, { code: CANARY_CODE, state });

      expect(h.github.revokeCalls).toHaveLength(0);
    });

    it('answers 404 while disabled, without consuming anything', async () => {
      const disabled = buildFlow({ enabled: false });

      expectHttp(await rejection(disabled.flow.callback(OWNER, { code: CANARY_CODE, state: `${MISSING_UUID}.${'A'.repeat(43)}` })), 404);
      expect(disabled.github.totalCallCount).toBe(0);
    });

    it('rejects a replayed state without a GitHub call or a counted failure', async () => {
      const state = await startState(h, { label: 'Work' });
      await h.flow.callback(OWNER, { code: CANARY_CODE, state });
      h.github.reset();

      expectHttp(await rejection(h.flow.callback(OWNER, { code: CANARY_CODE, state })), 400, ErrorCodes.INTEGRATION_REDIRECT_STATE_INVALID);
      expect(h.github.totalCallCount).toBe(0);
      expect(h.guard.state.get(OWNER)?.failedAttempts ?? 0).toBe(0);
    });

    it('rejects another user\'s state the same way', async () => {
      const state = await startState(h, { label: 'Work' });

      expectHttp(await rejection(h.flow.callback(INTRUDER, { code: CANARY_CODE, state })), 400, ErrorCodes.INTEGRATION_REDIRECT_STATE_INVALID);
      expect(h.github.totalCallCount).toBe(0);
    });

    it('makes a single code exchange for two parallel callbacks with one state', async () => {
      const state = await startState(h, { label: 'Work' });

      const results = await Promise.allSettled([
        h.flow.callback(OWNER, { code: CANARY_CODE, state }),
        h.flow.callback(OWNER, { code: CANARY_CODE, state }),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(h.github.exchangeCalls).toHaveLength(1);
    });

    it('answers 404 when the replace target was deleted before the callback', async () => {
      const uuid = await connect(h);
      const state = await startState(h, { integrationId: uuid });
      await h.service.delete(OWNER, uuid);
      h.github.reset();

      expectHttp(await rejection(h.flow.callback(OWNER, { code: CANARY_CODE, state })), 404);
      expect(h.github.totalCallCount).toBe(0);
    });

    it('answers 404 and revokes the new token when the target is deleted during validation', async () => {
      const uuid = await connect(h);
      const state = await startState(h, { integrationId: uuid });
      h.github.exchangeRespondWith(oauthExchangeResponse({ accessToken: new Secret(CANARY_NEW_TOKEN) }));
      jest.spyOn(h.github, 'getUser').mockImplementationOnce(async () => {
        h.repo.rows.splice(0, h.repo.rows.length);
        return githubUserResponse();
      });

      expectHttp(await rejection(h.flow.callback(OWNER, { code: CANARY_CODE, state })), 404);
      expect(h.github.revokedTokens).toEqual([CANARY_NEW_TOKEN]);
    });

    it('answers 423 during the cool-off, without a GitHub call', async () => {
      const state = await startState(h, { label: 'Work' });
      h.guard.state.set(OWNER, { failedAttempts: 3, lockedUntil: new Date(Date.now() + 60000) });

      expectHttp(await rejection(h.flow.callback(OWNER, { code: CANARY_CODE, state })), 423, ErrorCodes.INTEGRATION_CREDENTIAL_LOCKED);
      expect(h.github.totalCallCount).toBe(0);
    });

    it('answers 409 when the label was taken since start, without a GitHub call', async () => {
      const state = await startState(h, { label: 'Work' });
      await connect(h, 'work');

      expectHttp(await rejection(h.flow.callback(OWNER, { code: CANARY_CODE, state })), 409, ErrorCodes.INTEGRATION_LABEL_TAKEN);
      expect(h.github.totalCallCount).toBe(0);
    });

    it('answers 409 and revokes the new token when the label is taken during validation', async () => {
      const state = await startState(h, { label: 'Work' });
      h.github.exchangeRespondWith(oauthExchangeResponse({ accessToken: new Secret(CANARY_NEW_TOKEN) }));
      jest.spyOn(h.github, 'getUser').mockImplementationOnce(async () => {
        await h.service.create(OWNER, { label: 'work', provider: 'github', type: 'pat', credential: { token: CANARY_CLASSIC } });
        return githubUserResponse();
      });

      expectHttp(await rejection(h.flow.callback(OWNER, { code: CANARY_CODE, state })), 409, ErrorCodes.INTEGRATION_LABEL_TAKEN);
      expect(h.github.revokedTokens).toEqual([CANARY_NEW_TOKEN]);
      expect(h.repo.rows.filter((row) => row.type === 'oauth_app')).toHaveLength(0);
    });

    it('answers 409 and revokes the new token when the cap is reached during validation', async () => {
      const capped = buildFlow(ENABLED, 1);
      const state = await startState(capped, { label: 'Work' });
      capped.github.exchangeRespondWith(oauthExchangeResponse({ accessToken: new Secret(CANARY_NEW_TOKEN) }));
      jest.spyOn(capped.github, 'getUser').mockImplementationOnce(async () => {
        await capped.service.create(OWNER, { label: 'Other', provider: 'github', type: 'pat', credential: { token: CANARY_CLASSIC } });
        return githubUserResponse();
      });

      expectHttp(await rejection(capped.flow.callback(OWNER, { code: CANARY_CODE, state })), 409, ErrorCodes.INTEGRATIONS_LIMIT_REACHED);
      expect(capped.github.revokedTokens).toEqual([CANARY_NEW_TOKEN]);
      h = capped;
    });

    it('answers 409 at callback when the cap was reached since start', async () => {
      const capped = buildFlow(ENABLED, 1);
      const state = await startState(capped, { label: 'Second' });
      await connect(capped, 'First');

      expectHttp(await rejection(capped.flow.callback(OWNER, { code: CANARY_CODE, state })), 409, ErrorCodes.INTEGRATIONS_LIMIT_REACHED);
      expect(capped.github.totalCallCount).toBe(0);
      h = capped;
    });

    it.each([
      ['bad_verification_code', () => h.github.exchangeRespondWith(oauthExchangeResponse({ accessToken: null, error: 'bad_verification_code' })), 422, ErrorCodes.INTEGRATION_CREDENTIAL_INVALID, 1],
      ['a 401 on GET /user', () => h.github.respondWith(githubUserResponse({ status: 401, login: null })), 422, ErrorCodes.INTEGRATION_CREDENTIAL_INVALID, 1],
      ['no repo scope', () => h.github.respondWith(githubUserResponse({ oauthScopes: 'gist' })), 422, ErrorCodes.INTEGRATION_INSUFFICIENT_PERMISSIONS, 1],
      ['another exchange error', () => h.github.exchangeRespondWith(oauthExchangeResponse({ accessToken: null, error: 'redirect_uri_mismatch' })), 502, ErrorCodes.GITHUB_UNAVAILABLE, 0],
      ['a rate limit', () => h.github.respondWith(githubUserResponse({ status: 429, login: null, retryAfter: 7 })), 503, ErrorCodes.GITHUB_RATE_LIMITED, 0],
      ['a 5xx', () => h.github.respondWith(githubUserResponse({ status: 502, login: null })), 502, ErrorCodes.GITHUB_UNAVAILABLE, 0],
    ])('maps %s, counting it toward the cool-off only when the spec says so', async (_label, script, status, code, counted) => {
      const state = await startState(h, { label: 'Work' });
      script();

      expectHttp(await rejection(h.flow.callback(OWNER, { code: CANARY_CODE, state })), status, code);
      expect(h.guard.state.get(OWNER)?.failedAttempts ?? 0).toBe(counted);
      expect(h.repo.rows).toHaveLength(0);
    });

    it('revokes the new token when it lacks repo', async () => {
      const state = await startState(h, { label: 'Work' });
      h.github.respondWith(githubUserResponse({ oauthScopes: '' }));

      await rejection(h.flow.callback(OWNER, { code: CANARY_CODE, state }));

      expect(h.github.revokedTokens).toEqual([CANARY_OAUTH_TOKEN]);
    });
  });
});
