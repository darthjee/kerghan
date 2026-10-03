import { appInstallationResponse, installationsPage } from './support/fake-github-client.js';
import {
  CANARY_CODE,
  connect,
  entry,
  expectHttp,
  INTRUDER,
  MISSING_UUID,
  OWNER,
  rejection,
  resetGithub,
  startState,
} from './support/github-app-flow-helpers.js';
import { buildGithubAppHarness, GithubAppHarness } from './support/github-app-harness.js';
import { enabledGithubAppConfig } from './support/github-app-test-config.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { selectionEntries } from '../types/github-app/github-app-selection.service.js';

/**
 * Runs a connect callback that answers a selection of three installations.
 * @param {GithubAppHarness} h - The harness.
 * @param {object} body - The start body.
 * @param {string} [body.label] - The label (create).
 * @param {string} [body.integrationId] - The target (replace).
 * @returns {Promise<string>} The selection `state`.
 */
async function selectionState(h: GithubAppHarness, body: { label?: string; integrationId?: string } = { label: 'Work' }): Promise<string> {
  const state = await startState(h, { ...body, mode: 'connect' });
  h.github.installationsQueue.push(installationsPage({
    installations: [entry(12345678, 'acme'), entry(23456789, 'octocat'), entry(34567890, 'zeta')],
  }));
  const result = await h.flow.callback(OWNER, { code: CANARY_CODE, state });

  if (result.kind !== 'selection') {
    throw new Error('expected a selection');
  }

  resetGithub(h);

  return result.selection.state;
}

describe('GithubAppSelectionService', () => {
  let h: GithubAppHarness;

  beforeEach(() => {
    h = buildGithubAppHarness();
  });

  const failures = (): number => h.guard.state.get(OWNER)?.failedAttempts ?? 0;

  it('stores the chosen installation (201) with the verifying login from the callback', async () => {
    const state = await selectionState(h);
    h.github.appInstallationQueue.push(appInstallationResponse({ installationId: 23456789, accountLogin: 'octocat', accountType: 'User' }));

    const result = await h.selection.select(OWNER, { state, installationId: 23456789 });

    expect(result).toMatchObject({
      created: true,
      integration: {
        githubLogin: 'octocat',
        secretHint: 'installation …6789',
        metadata: { installationId: 23456789, accountType: 'User', verifiedBy: 'octocat' },
      },
    });
    expect(h.github.appInstallationCalls.map((call) => call.installationId)).toEqual([23456789]);
    expect(h.github.exchangeCalls).toHaveLength(0);
    expect(h.states.rows).toHaveLength(0);
    expect(failures()).toBe(0);
  });

  it('replaces (200) through a selection', async () => {
    const uuid = await connect(h);
    const state = await selectionState(h, { integrationId: uuid });

    expect(await h.selection.select(OWNER, { state, installationId: 12345678 })).toMatchObject({
      created: false, integration: { id: uuid },
    });
  });

  it('rejects an id outside the candidates (422, counted, no app-JWT call)', async () => {
    const state = await selectionState(h);

    expectHttp(await rejection(h.selection.select(OWNER, { state, installationId: 999 })), 422,
      ErrorCodes.INTEGRATION_INSTALLATION_NOT_ACCESSIBLE);
    expect(failures()).toBe(1);
    expect(h.github.appJwtCallCount).toBe(0);
    expect(h.repo.rows).toHaveLength(0);
  });

  it.each([
    ['a redirect state', async (harness: GithubAppHarness): Promise<string> => startState(harness, { label: 'Work' })],
    ['another user\'s state', async (harness: GithubAppHarness): Promise<string> => {
      const state = await selectionState(harness);
      harness.states.rows[0].userId = INTRUDER;
      return state;
    }],
    ['an unknown state', async (): Promise<string> => `${MISSING_UUID}.${'A'.repeat(43)}`],
    ['a replayed state', async (harness: GithubAppHarness): Promise<string> => {
      const state = await selectionState(harness);
      await harness.selection.select(OWNER, { state, installationId: 12345678 });
      harness.github.reset();
      return state;
    }],
  ])('rejects %s (400, no GitHub call, not counted)', async (_label, make) => {
    const state = await make(h);
    const before = failures();

    expectHttp(await rejection(h.selection.select(OWNER, { state, installationId: 12345678 })), 400,
      ErrorCodes.INTEGRATION_REDIRECT_STATE_INVALID);
    expect(h.github.totalCallCount).toBe(0);
    expect(failures()).toBe(before);
  });

  it('answers 404 for a replace target deleted meanwhile', async () => {
    const uuid = await connect(h);
    const state = await selectionState(h, { integrationId: uuid });
    await h.service.delete(OWNER, uuid);

    expectHttp(await rejection(h.selection.select(OWNER, { state, installationId: 12345678 })), 404);
  });

  it('answers 409 when the label was taken meanwhile, and when the cap was reached', async () => {
    const state = await selectionState(h);
    await connect(h, 'WORK');

    expectHttp(await rejection(h.selection.select(OWNER, { state, installationId: 12345678 })), 409,
      ErrorCodes.INTEGRATION_LABEL_TAKEN);

    const capped = buildGithubAppHarness(enabledGithubAppConfig(), { maxPerUser: 1 });
    const cappedState = await selectionState(capped, { label: 'Second' });
    await connect(capped, 'First');
    expectHttp(await rejection(capped.selection.select(OWNER, { state: cappedState, installationId: 12345678 })), 409,
      ErrorCodes.INTEGRATIONS_LIMIT_REACHED);
  });

  it('answers 423 during the cool-off', async () => {
    const state = await selectionState(h);
    h.guard.state.set(OWNER, { failedAttempts: 3, lockedUntil: new Date(Date.now() + 60000) });

    expectHttp(await rejection(h.selection.select(OWNER, { state, installationId: 12345678 })), 423);
  });

  it('maps installation failures, counted', async () => {
    const state = await selectionState(h);
    h.github.appInstallationQueue.push(appInstallationResponse({ suspended: true }));

    expectHttp(await rejection(h.selection.select(OWNER, { state, installationId: 12345678 })), 422,
      ErrorCodes.INTEGRATION_INSTALLATION_SUSPENDED);
    expect(failures()).toBe(1);
  });

  it('answers 404 while disabled', async () => {
    const disabled = buildGithubAppHarness({ enabled: false });

    expectHttp(await rejection(disabled.selection.select(OWNER, { state: `${MISSING_UUID}.${'A'.repeat(43)}`, installationId: 1 })), 404);
  });

  it('sorts case-insensitively, deduplicates and caps the entries', () => {
    expect(selectionEntries([entry(2, 'b'), entry(1, 'B'), entry(2, 'b'), entry(3, 'a')]).map((e) => e.installationId))
      .toEqual([3, 1, 2]);
  });
});
