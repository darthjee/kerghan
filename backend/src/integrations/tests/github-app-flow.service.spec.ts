import { inspect } from 'node:util';
import {
  appInstallationResponse,
  CANARY_USER_TOKEN,
  githubAppExchangeResponse,
  githubUserResponse,
  installationsPage,
} from './support/fake-github-client.js';
import {
  CANARY_CODE,
  connect,
  entry,
  expectHttp,
  INTRUDER,
  MISSING_UUID,
  OWNER,
  rejection,
  startState,
} from './support/github-app-flow-helpers.js';
import { buildGithubAppHarness, GithubAppHarness } from './support/github-app-harness.js';
import { CANARY_APP_CLIENT_SECRET, enabledGithubAppConfig, TEST_APP_CLIENT_ID } from './support/github-app-test-config.js';
import { CANARY_CLASSIC, CANARY_FRAGMENT } from './support/integrations-harness.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { pickInstallation } from '../types/github-app/github-app-flow.service.js';

const INSTALL = { installationId: 12345678, setupAction: 'install' as const };

describe('GithubAppFlowService', () => {
  let h: GithubAppHarness;

  beforeEach(() => {
    h = buildGithubAppHarness();
  });

  afterEach(() => {
    const logged = Object.values(h.logger).flatMap((mock) => mock.mock.calls);

    expect(inspect(logged, { depth: 10 })).not.toContain(CANARY_FRAGMENT);
    expect(JSON.stringify(h.repo.rows.map((row) => [row.metadata, row.secretHint]))).not.toContain(CANARY_FRAGMENT);
    expect(JSON.stringify(h.states.rows)).not.toContain(CANARY_FRAGMENT);
  });

  const failures = (userId = OWNER): number => h.guard.state.get(userId)?.failedAttempts ?? 0;

  describe('start', () => {
    it('answers the installation page URL by default, with no GitHub call', async () => {
      const { redirectUrl } = await h.flow.start(OWNER, { label: 'Work' });

      expect(redirectUrl).toMatch(/^https:\/\/github\.com\/apps\/kerghan-test\/installations\/new\?state=[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
      expect(h.states.rows[0]).toMatchObject({ userId: OWNER, stage: 'redirect', purpose: 'create', label: 'Work' });
      expect(h.github.totalCallCount).toBe(0);
      expect(redirectUrl).not.toContain(CANARY_APP_CLIENT_SECRET);
    });

    it('answers the authorize URL in connect mode', async () => {
      const { redirectUrl } = await h.flow.start(OWNER, { label: 'Work', mode: 'connect' });
      const url = new URL(redirectUrl);

      expect(redirectUrl.startsWith('https://github.com/login/oauth/authorize?')).toBe(true);
      expect(url.searchParams.get('client_id')).toBe(TEST_APP_CLIENT_ID);
      expect(url.searchParams.get('state')).toBe(`${h.states.rows[0].uuid}.${url.searchParams.get('state')?.split('.')[1]}`);
      expect(url.searchParams.has('scope')).toBe(false);
      expect(url.searchParams.has('code_challenge')).toBe(false);
    });

    it.each(['install', 'connect'] as const)('starts a replace for an owned github_app row (%s)', async (mode) => {
      const uuid = await connect(h);

      await h.flow.start(OWNER, { integrationId: uuid, mode });

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
      const disabled = buildGithubAppHarness({ enabled: false });

      expectHttp(await rejection(disabled.flow.start(OWNER, { label: 'Work' })), 404);
      expect(disabled.states.rows).toHaveLength(0);
    });

    it.each([
      ['missing', async (): Promise<string> => MISSING_UUID],
      ['foreign', async (harness: GithubAppHarness): Promise<string> => connect(harness)],
    ])('answers 404 for a %s target, even while locked out', async (_label, target) => {
      const uuid = await target(h);
      h.guard.state.set(INTRUDER, { failedAttempts: 3, lockedUntil: new Date(Date.now() + 60000) });

      expectHttp(await rejection(h.flow.start(INTRUDER, { integrationId: uuid })), 404);
      expect(h.states.rows).toHaveLength(0);
    });

    it('rejects a non-github_app target', async () => {
      const pat = await h.service.create(OWNER, { label: 'Pat', provider: 'github', type: 'pat', credential: { token: CANARY_CLASSIC } });

      expectHttp(await rejection(h.flow.start(OWNER, { integrationId: pat.id })), 400, ErrorCodes.INTEGRATION_FLOW_UNSUPPORTED);
    });

    it('answers 423 during the cool-off', async () => {
      h.guard.state.set(OWNER, { failedAttempts: 3, lockedUntil: new Date(Date.now() + 60000) });

      expectHttp(await rejection(h.flow.start(OWNER, { label: 'Work' })), 423, ErrorCodes.INTEGRATION_CREDENTIAL_LOCKED);
      expect(h.states.rows).toHaveLength(0);
    });

    it('answers 409 when the cap is reached, and for a duplicate label', async () => {
      const capped = buildGithubAppHarness(enabledGithubAppConfig(), { maxPerUser: 1 });
      await connect(capped, 'First');

      expectHttp(await rejection(capped.flow.start(OWNER, { label: 'Second' })), 409, ErrorCodes.INTEGRATIONS_LIMIT_REACHED);
      await connect(h, 'Work');
      expectHttp(await rejection(h.flow.start(OWNER, { label: 'WORK' })), 409, ErrorCodes.INTEGRATION_LABEL_TAKEN);
      expect(h.github.totalCallCount).toBe(0);
    });

    it('purges expired rows and keeps at most 5 pending rows per user', async () => {
      for (const label of ['a', 'b', 'c', 'd', 'e', 'f']) {
        await h.flow.start(OWNER, { label });
      }

      expect(h.states.rows.map((row) => row.label)).toEqual(['b', 'c', 'd', 'e', 'f']);
    });
  });

  describe('callback', () => {
    it('creates an active row (201) from an install, and revokes the user token', async () => {
      const state = await startState(h, { label: 'Work' });

      const result = await h.flow.callback(OWNER, { code: CANARY_CODE, state, ...INSTALL });

      expect(result.kind).toBe('stored');
      expect(result).toMatchObject({
        created: true,
        integration: {
          type: 'github_app',
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
        },
      });
      expect(h.github.revokedTokens).toEqual([CANARY_USER_TOKEN]);
      expect(h.states.rows).toHaveLength(0);
      expect(JSON.stringify(result)).not.toContain(CANARY_FRAGMENT);
      expect(JSON.stringify(h.repo.rows[0].secretCiphertext)).not.toContain('12345678');
    });

    it('accepts update as the setup action', async () => {
      const state = await startState(h, { label: 'Work' });

      expect((await h.flow.callback(OWNER, { code: CANARY_CODE, state, installationId: 12345678, setupAction: 'update' })).kind)
        .toBe('stored');
    });

    it('replaces (200) without any call about the previous installation', async () => {
      const uuid = await connect(h);
      const state = await startState(h, { integrationId: uuid });
      h.github.installationsQueue.push(installationsPage({ installations: [entry(999, 'octocat')] }));
      h.github.appInstallationQueue.push(appInstallationResponse({ installationId: 999, accountLogin: 'octocat', accountType: 'User' }));

      const result = await h.flow.callback(OWNER, { code: CANARY_CODE, state, installationId: 999, setupAction: 'install' });

      expect(result).toMatchObject({ kind: 'stored', created: false, integration: { id: uuid, githubLogin: 'octocat', secretHint: 'installation …999' } });
      expect(h.github.appInstallationCalls.map((call) => call.installationId)).toEqual([999]);
      expect(h.repo.rows).toHaveLength(1);
    });

    it('stores the only installation in connect mode', async () => {
      const state = await startState(h, { label: 'Work', mode: 'connect' });

      expect(await h.flow.callback(OWNER, { code: CANARY_CODE, state })).toMatchObject({ kind: 'stored', created: true });
    });

    it('answers a sorted, filtered selection in connect mode, with a select row, and no reset nor failure', async () => {
      h.guard.state.set(OWNER, { failedAttempts: 2, lockedUntil: null });
      const state = await startState(h, { label: 'Work', mode: 'connect' });
      h.github.installationsQueue.push(installationsPage({
        installations: [entry(3, 'zeta'), entry(1, 'octocat'), entry(2, 'Acme'), entry(4, 'other-app', 777)],
      }));

      const result = await h.flow.callback(OWNER, { code: CANARY_CODE, state });

      expect(result.kind).toBe('selection');
      if (result.kind !== 'selection') {
        return;
      }
      expect(result.selection.installations).toEqual([
        { installationId: 2, accountLogin: 'Acme', accountType: 'Organization' },
        { installationId: 1, accountLogin: 'octocat', accountType: 'User' },
        { installationId: 3, accountLogin: 'zeta', accountType: 'Organization' },
      ]);
      expect(result.selection.state).toMatch(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
      expect(h.states.rows).toEqual([expect.objectContaining({
        stage: 'select', purpose: 'create', label: 'Work', candidateInstallationIds: [2, 1, 3], verifiedBy: 'octocat',
      })]);
      expect(h.repo.rows).toHaveLength(0);
      expect(h.github.appJwtCallCount).toBe(0);
      expect(h.github.revokedTokens).toEqual([CANARY_USER_TOKEN]);
      expect(failures()).toBe(2);
    });

    it('caps the selection at 100', async () => {
      const state = await startState(h, { label: 'Work', mode: 'connect' });
      const many = Array.from({ length: 120 }, (_, index) => entry(index + 1, `acct-${String(index).padStart(3, '0')}`));
      h.github.installationsQueue.push(installationsPage({ installations: many }));

      const result = await h.flow.callback(OWNER, { code: CANARY_CODE, state });

      expect(result.kind === 'selection' && result.selection.installations).toHaveLength(100);
      expect(h.states.rows[0].candidateInstallationIds).toHaveLength(100);
    });

    it('answers 422 (counted) in connect mode without any installation', async () => {
      const state = await startState(h, { label: 'Work', mode: 'connect' });
      h.github.installationsQueue.push(installationsPage({ installations: [entry(5, 'acme', 777)] }));

      expectHttp(await rejection(h.flow.callback(OWNER, { code: CANARY_CODE, state })), 422,
        ErrorCodes.INTEGRATION_INSTALLATION_NOT_ACCESSIBLE);
      expect(failures()).toBe(1);
    });

    describe('ownership', () => {
      it('rejects a forged installation id (422, counted, no app-JWT call, nothing stored, token revoked)', async () => {
        const state = await startState(h, { label: 'Work' });

        const error = await rejection(h.flow.callback(OWNER, { code: CANARY_CODE, state, installationId: 424242, setupAction: 'install' }));

        expectHttp(error, 422, ErrorCodes.INTEGRATION_INSTALLATION_NOT_ACCESSIBLE);
        expect(h.github.appJwtCallCount).toBe(0);
        expect(h.repo.rows).toHaveLength(0);
        expect(failures()).toBe(1);
        expect(h.github.revokedTokens).toEqual([CANARY_USER_TOKEN]);
      });

      it('ignores another app\'s installation in the user\'s list', async () => {
        const state = await startState(h, { label: 'Work' });
        h.github.installationsQueue.push(installationsPage({ installations: [entry(12345678, 'acme', 777)] }));

        expectHttp(await rejection(h.flow.callback(OWNER, { code: CANARY_CODE, state, ...INSTALL })), 422,
          ErrorCodes.INTEGRATION_INSTALLATION_NOT_ACCESSIBLE);
        expect(h.github.appJwtCallCount).toBe(0);
      });

      it('answers the same body for a missing, foreign or other-app installation', async () => {
        const bodies: unknown[] = [];

        for (const installations of [[], [entry(1, 'someone')], [entry(12345678, 'acme', 777)]]) {
          const state = await startState(h, { label: 'Work' });
          h.github.installationsQueue.push(installationsPage({ installations }));
          bodies.push((await rejection(h.flow.callback(OWNER, { code: CANARY_CODE, state, ...INSTALL }))).getResponse());
        }

        expect(bodies[1]).toEqual(bodies[0]);
        expect(bodies[2]).toEqual(bodies[0]);
      });

      it('lets a second user connect the same installation, isolated', async () => {
        await connect(h);
        const state = await startState(h, { label: 'Work' }, INTRUDER);

        expect(await h.flow.callback(INTRUDER, { code: CANARY_CODE, state, ...INSTALL })).toMatchObject({ kind: 'stored', created: true });
        expect(h.repo.rows.map((row) => row.userId)).toEqual([OWNER, INTRUDER]);
      });
    });

    describe('state', () => {
      it.each([
        ['an unknown state', async (): Promise<string> => `${MISSING_UUID}.${'A'.repeat(43)}`],
        ['a replayed state', async (harness: GithubAppHarness): Promise<string> => {
          const state = await startState(harness, { label: 'Once' });
          await harness.flow.callback(OWNER, { code: CANARY_CODE, state, ...INSTALL });
          harness.github.reset();
          return state;
        }],
        ['another user\'s state', async (harness: GithubAppHarness): Promise<string> => startState(harness, { label: 'Work' }, INTRUDER)],
        ['a select state', async (harness: GithubAppHarness): Promise<string> => {
          const state = await startState(harness, { label: 'Work', mode: 'connect' });
          harness.github.installationsQueue.push(installationsPage({ installations: [entry(1, 'a'), entry(2, 'b')] }));
          const result = await harness.flow.callback(OWNER, { code: CANARY_CODE, state });
          harness.github.reset();
          return result.kind === 'selection' ? result.selection.state : '';
        }],
      ])('rejects %s (400, no GitHub call, not counted)', async (_label, make) => {
        const state = await make(h);
        const before = failures();

        expectHttp(await rejection(h.flow.callback(OWNER, { code: CANARY_CODE, state })), 400,
          ErrorCodes.INTEGRATION_REDIRECT_STATE_INVALID);
        expect(h.github.totalCallCount).toBe(0);
        expect(failures()).toBe(before);
      });

      it('makes a single code exchange for two parallel callbacks with the same state', async () => {
        const state = await startState(h, { label: 'Work' });

        const results = await Promise.allSettled([
          h.flow.callback(OWNER, { code: CANARY_CODE, state, ...INSTALL }),
          h.flow.callback(OWNER, { code: CANARY_CODE, state, ...INSTALL }),
        ]);

        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        expect(h.github.exchangeCalls).toHaveLength(1);
      });
    });

    it('answers 404 for a replace target deleted meanwhile', async () => {
      const uuid = await connect(h);
      const state = await startState(h, { integrationId: uuid });
      await h.service.delete(OWNER, uuid);

      expectHttp(await rejection(h.flow.callback(OWNER, { code: CANARY_CODE, state, ...INSTALL })), 404);
      expect(h.github.totalCallCount).toBe(0);
    });

    it('answers 409 when the label was taken meanwhile, and when the cap was reached', async () => {
      const state = await startState(h, { label: 'Work' });
      await connect(h, 'work');

      expectHttp(await rejection(h.flow.callback(OWNER, { code: CANARY_CODE, state, ...INSTALL })), 409,
        ErrorCodes.INTEGRATION_LABEL_TAKEN);

      const capped = buildGithubAppHarness(enabledGithubAppConfig(), { maxPerUser: 1 });
      const cappedState = await startState(capped, { label: 'Second' });
      await connect(capped, 'First');
      expectHttp(await rejection(capped.flow.callback(OWNER, { code: CANARY_CODE, state: cappedState, ...INSTALL })), 409,
        ErrorCodes.INTEGRATIONS_LIMIT_REACHED);
      expect(capped.github.totalCallCount).toBe(0);
    });

    it('answers 423 during the cool-off, without any GitHub call', async () => {
      const state = await startState(h, { label: 'Work' });
      h.guard.state.set(OWNER, { failedAttempts: 3, lockedUntil: new Date(Date.now() + 60000) });

      expectHttp(await rejection(h.flow.callback(OWNER, { code: CANARY_CODE, state, ...INSTALL })), 423);
      expect(h.github.totalCallCount).toBe(0);
    });

    it('answers 404 while disabled', async () => {
      const disabled = buildGithubAppHarness({ enabled: false });

      expectHttp(await rejection(disabled.flow.callback(OWNER, { code: CANARY_CODE, state: `${MISSING_UUID}.${'A'.repeat(43)}` })), 404);
    });

    describe('error mapping', () => {
      it.each([
        ['bad_verification_code', () => h.github.exchangeRespondWith(githubAppExchangeResponse({ accessToken: null, error: 'bad_verification_code' })), 422, ErrorCodes.INTEGRATION_CREDENTIAL_INVALID, 1],
        ['incorrect_client_credentials', () => h.github.exchangeRespondWith(githubAppExchangeResponse({ accessToken: null, error: 'incorrect_client_credentials' })), 502, ErrorCodes.GITHUB_UNAVAILABLE, 0],
        ['GET /user 401', () => h.github.respondWith(githubUserResponse({ status: 401, login: null })), 422, ErrorCodes.INTEGRATION_CREDENTIAL_INVALID, 1],
        ['installations 401', () => h.github.installationsQueue.push(installationsPage({ status: 401, installations: null })), 422, ErrorCodes.INTEGRATION_CREDENTIAL_INVALID, 1],
        ['lookup 404', () => h.github.appInstallationQueue.push(appInstallationResponse({}, { status: 404, installation: null })), 422, ErrorCodes.INTEGRATION_INSTALLATION_NOT_ACCESSIBLE, 1],
        ['another app id', () => h.github.appInstallationQueue.push(appInstallationResponse({ appId: 1 })), 422, ErrorCodes.INTEGRATION_INSTALLATION_NOT_ACCESSIBLE, 1],
        ['missing permissions', () => h.github.appInstallationQueue.push(appInstallationResponse({ permissions: { issues: null, metadata: 'read' } })), 422, ErrorCodes.INTEGRATION_INSUFFICIENT_PERMISSIONS, 1],
        ['suspended', () => h.github.appInstallationQueue.push(appInstallationResponse({ suspended: true })), 422, ErrorCodes.INTEGRATION_INSTALLATION_SUSPENDED, 1],
        ['app-JWT 401', () => h.github.appInstallationQueue.push(appInstallationResponse({}, { status: 401, installation: null })), 502, ErrorCodes.GITHUB_UNAVAILABLE, 0],
        ['rate limit', () => h.github.appInstallationQueue.push(appInstallationResponse({}, { status: 403, installation: null, rateLimitRemaining: 0 })), 503, ErrorCodes.GITHUB_RATE_LIMITED, 0],
      ])('maps %s', async (_label, script, status, code, counted) => {
        const state = await startState(h, { label: 'Work' });
        script();

        expectHttp(await rejection(h.flow.callback(OWNER, { code: CANARY_CODE, state, ...INSTALL })), status, code);
        expect(failures()).toBe(counted);
        expect(h.repo.rows).toHaveLength(0);
      });

      it('revokes the user token on every failure after the exchange', async () => {
        const state = await startState(h, { label: 'Work' });
        h.github.appInstallationQueue.push(appInstallationResponse({ suspended: true }));

        await rejection(h.flow.callback(OWNER, { code: CANARY_CODE, state, ...INSTALL }));

        expect(h.github.revokedTokens).toEqual([CANARY_USER_TOKEN]);
      });
    });
  });

  describe('pickInstallation', () => {
    it('answers null for several installations without a claim', () => {
      expect(pickInstallation([entry(1, 'a'), entry(2, 'b')], undefined)).toBeNull();
    });
  });
});
