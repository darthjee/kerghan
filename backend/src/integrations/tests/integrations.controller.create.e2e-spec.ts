import { expectErrorBody, expectValidationErrorBody } from '../../auth/tests/support/error-body.js';
import { GithubClientError } from '../github-client.service.js';
import {
  createIntegration,
  expectSafeBody,
  TEST_COOLDOWN_MS,
  TEST_MAX_ATTEMPTS,
  TEST_MAX_PER_USER,
  useIntegrationsTestApp,
} from './support/build-integrations-test-app.js';
import { githubUserResponse } from './support/fake-github-client.js';
import { CANARY_CLASSIC, CANARY_FINE, CANARY_FRAGMENT } from './support/integrations-harness.js';

describe('IntegrationsController create (e2e)', () => {
  const { ctx } = useIntegrationsTestApp();

  it('answers 201 with the integration', async () => {
    const response = await createIntegration(ctx, ctx.owner);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
      provider: 'github',
      type: 'pat',
      label: 'Work',
      status: 'active',
      statusReason: null,
      secretHint: 'ghp_…a1b2',
      githubLogin: 'octocat',
      metadata: { tokenKind: 'classic', scopes: ['read:org', 'repo'], permissionsVerified: true },
      expiresAt: null,
      lastTestedAt: expect.any(String),
      nextTestAt: expect.any(String),
      lastTestResult: 'success',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(Date.parse(response.body.nextTestAt) - Date.parse(response.body.lastTestedAt)).toBe(TEST_COOLDOWN_MS);
    expectSafeBody(response.body);
    expect(ctx.repo.rows[0].userId).toBe(ctx.userRepo.rows[0].id);
  });

  it('trims the label and accepts a fine-grained token', async () => {
    const response = await createIntegration(ctx, ctx.owner, { label: '  Home  ', credential: { token: ` ${CANARY_FINE} ` } });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ label: 'Home', secretHint: 'github_pat_…c3d4' });
  });

  it('ignores an owner smuggled in the body', async () => {
    const response = await createIntegration(ctx, ctx.owner, { userId: 999, user_id: 999 });

    expect(response.status).toBe(201);
    expect(ctx.repo.rows[0].userId).toBe(ctx.userRepo.rows[0].id);
  });

  it.each([
    ['a missing label', { label: undefined }],
    ['a blank label', { label: '   ' }],
    ['a 101-character label', { label: 'x'.repeat(101) }],
    ['an unknown provider', { provider: 'gitlab' }],
    ['an unknown type', { type: 'carrier_pigeon' }],
    ['a non-object credential', { credential: CANARY_CLASSIC }],
  ])('answers 400 VALIDATION_FAILED for %s, without echoing the credential', async (_label, overrides) => {
    const response = await createIntegration(ctx, ctx.owner, overrides);

    expectValidationErrorBody(response);
    expect(JSON.stringify(response.body)).not.toContain(CANARY_FRAGMENT);
    expect(ctx.github.callCount).toBe(0);
  });

  it('accepts a 100-character label', async () => {
    expect((await createIntegration(ctx, ctx.owner, { label: 'x'.repeat(100) })).status).toBe(201);
  });

  it.each([
    ['an unknown prefix', { token: `gho_${CANARY_FRAGMENT}` }],
    ['an unknown credential field', { token: CANARY_CLASSIC, extra: 'x' }],
    ['a bad character', { token: `ghp_${CANARY_FRAGMENT}!` }],
  ])('answers 400 VALIDATION_FAILED for %s in the credential', async (_label, credential) => {
    const response = await createIntegration(ctx, ctx.owner, { credential });

    expectValidationErrorBody(response);
    expect(JSON.stringify(response.body)).not.toContain(CANARY_FRAGMENT);
    expect(ctx.github.callCount).toBe(0);
  });

  it('answers 400 INTEGRATION_FLOW_UNSUPPORTED for a type without a credential-paste flow', async () => {
    const response = await createIntegration(ctx, ctx.owner, { type: 'github_app' });

    expectErrorBody(response, { status: 400, code: 'INTEGRATION_FLOW_UNSUPPORTED' });
    expect(ctx.github.callCount).toBe(0);
  });

  it('answers 409 INTEGRATION_LABEL_TAKEN for a case-insensitive duplicate, without a GitHub call', async () => {
    await createIntegration(ctx, ctx.owner, { label: 'Work' });
    ctx.github.reset();

    expectErrorBody(await createIntegration(ctx, ctx.owner, { label: ' work ' }), {
      status: 409,
      code: 'INTEGRATION_LABEL_TAKEN',
    });
    expect(ctx.github.callCount).toBe(0);
  });

  it('answers 409 INTEGRATIONS_LIMIT_REACHED past the cap, without a GitHub call', async () => {
    for (let index = 0; index < TEST_MAX_PER_USER; index += 1) {
      expect((await createIntegration(ctx, ctx.owner, { label: `L${index}` })).status).toBe(201);
    }
    ctx.github.reset();

    expectErrorBody(await createIntegration(ctx, ctx.owner, { label: 'One more' }), {
      status: 409,
      code: 'INTEGRATIONS_LIMIT_REACHED',
    });
    expect(ctx.github.callCount).toBe(0);
  });

  it.each([
    ['a 401', githubUserResponse({ status: 401, login: null }), 422, 'INTEGRATION_CREDENTIAL_INVALID'],
    ['a classic token without repo', githubUserResponse({ oauthScopes: 'public_repo' }), 422, 'INTEGRATION_INSUFFICIENT_PERMISSIONS'],
    ['GitHub unreachable', new GithubClientError('network_error'), 502, 'GITHUB_UNAVAILABLE'],
    ['a GitHub 5xx', githubUserResponse({ status: 502, login: null }), 502, 'GITHUB_UNAVAILABLE'],
  ])('answers %s with %i %s and stores nothing', async (_label, answer, status, code) => {
    ctx.github.respondWith(answer);

    const response = await createIntegration(ctx, ctx.owner);

    expectErrorBody(response, { status, code });
    expect(JSON.stringify(response.body)).not.toContain(CANARY_FRAGMENT);
    expect(ctx.repo.rows).toHaveLength(0);
  });

  it('answers a GitHub rate limit with 503 GITHUB_RATE_LIMITED and Retry-After', async () => {
    ctx.github.respondWith(githubUserResponse({ status: 429, login: null, retryAfter: 61 }));

    const response = await createIntegration(ctx, ctx.owner);

    expectErrorBody(response, { status: 503, code: 'GITHUB_RATE_LIMITED' });
    expect(response.headers['retry-after']).toBe('61');
  });

  it('trips the cool-off after the configured failures, then answers 423 without a GitHub call', async () => {
    ctx.github.respondByDefault(githubUserResponse({ status: 401, login: null }));

    for (let index = 0; index < TEST_MAX_ATTEMPTS; index += 1) {
      expect((await createIntegration(ctx, ctx.owner)).status).toBe(422);
    }

    expectErrorBody(await createIntegration(ctx, ctx.owner), { status: 423, code: 'INTEGRATION_CREDENTIAL_LOCKED' });
    expect(ctx.github.callCount).toBe(TEST_MAX_ATTEMPTS);
  });

  it('checks the cool-off before the cap and the label', async () => {
    await createIntegration(ctx, ctx.owner, { label: 'Work' });
    ctx.guard.state.set(ctx.userRepo.rows[0].id, { failedAttempts: 9, lockedUntil: new Date(Date.now() + 60000) });

    expect((await createIntegration(ctx, ctx.owner, { label: 'Work' })).status).toBe(423);
  });

  it('ignores transient failures in the cool-off', async () => {
    ctx.github.respondByDefault(githubUserResponse({ status: 500, login: null }));

    for (let index = 0; index < TEST_MAX_ATTEMPTS + 1; index += 1) {
      expect((await createIntegration(ctx, ctx.owner)).status).toBe(502);
    }
  });
});
