import { createHash } from 'node:crypto';
import { inspect } from 'node:util';
import { HttpException } from '@nestjs/common';
import { createInMemoryGithubAppStateRepo, InMemoryGithubAppStateRepo } from './support/in-memory-github-app-states.js';
import { ErrorCodes } from '../../core/error-codes.js';
import {
  GITHUB_APP_STATE_PATTERN,
  GITHUB_APP_STATE_TTL_MS,
  GithubAppStateService,
} from '../types/github-app/github-app-state.service.js';

const OWNER = 1;
const INTRUDER = 2;
const TARGET_UUID = '0b6c1f8e-3a52-4c1b-9d5a-6f2e7c8d9a10';
const CREATE = { purpose: 'create' as const, label: 'Work' };
const REPLACE = { purpose: 'replace' as const, integrationUuid: TARGET_UUID };

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
 * Asserts an exception is the generic invalid-state 400, holding none of the given values.
 * @param {HttpException} error - The exception.
 * @param {string[]} secrets - Values that must not appear.
 */
function expectInvalidState(error: HttpException, secrets: string[] = []): void {
  expect(error.getStatus()).toBe(400);
  expect(error.getResponse()).toEqual({
    code: ErrorCodes.INTEGRATION_REDIRECT_STATE_INVALID,
    message: 'This GitHub authorization link expired or was already used',
  });

  const text = `${error.message} ${inspect(error, { depth: 10 })} ${JSON.stringify(error.getResponse())}`;
  secrets.forEach((secret) => expect(text).not.toContain(secret));
}

describe('GithubAppStateService', () => {
  let repo: InMemoryGithubAppStateRepo;
  let service: GithubAppStateService;

  beforeEach(() => {
    repo = createInMemoryGithubAppStateRepo();
    service = new GithubAppStateService(repo as never);
  });

  describe('issueRedirect', () => {
    it('returns a well-formed state and stores only the secret hash', async () => {
      const state = await service.issueRedirect(OWNER, CREATE);
      const [uuid, secret] = state.split('.');

      expect(state).toMatch(GITHUB_APP_STATE_PATTERN);
      expect(repo.rows).toHaveLength(1);
      expect(repo.rows[0]).toMatchObject({
        uuid,
        userId: OWNER,
        secretHash: createHash('sha256').update(secret).digest('hex'),
        stage: 'redirect',
        purpose: 'create',
        label: 'Work',
        integrationUuid: null,
        candidateInstallationIds: null,
        verifiedBy: null,
      });
      expect(JSON.stringify(repo.rows)).not.toContain(secret);
    });

    it('stores a replace target and an expiry 10 minutes ahead', async () => {
      const now = new Date('2026-10-02T12:00:00Z');

      await service.issueRedirect(OWNER, REPLACE, now);

      expect(repo.rows[0]).toMatchObject({ purpose: 'replace', label: null, integrationUuid: TARGET_UUID });
      expect(repo.rows[0].expiresAt.getTime()).toBe(now.getTime() + GITHUB_APP_STATE_TTL_MS);
    });

    it('purges every expired row', async () => {
      const past = new Date(Date.now() - 2 * GITHUB_APP_STATE_TTL_MS);
      await service.issueRedirect(OWNER, { purpose: 'create', label: 'Old' }, past);
      await service.issueRedirect(INTRUDER, { purpose: 'create', label: 'Old' }, past);

      await service.issueRedirect(OWNER, { purpose: 'create', label: 'New' });

      expect(repo.rows.map((row) => row.label)).toEqual(['New']);
    });

    it('keeps at most 5 pending rows per user, dropping the oldest', async () => {
      for (const label of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
        await service.issueRedirect(OWNER, { purpose: 'create', label });
      }
      await service.issueRedirect(INTRUDER, CREATE);

      expect(repo.rows.filter((row) => row.userId === OWNER).map((row) => row.label)).toEqual(['c', 'd', 'e', 'f', 'g']);
      expect(repo.rows.filter((row) => row.userId === INTRUDER)).toHaveLength(1);
    });
  });

  describe('issueSelect', () => {
    it('stores a select row with the candidates, capped at 100, and its own 10 minutes', async () => {
      const now = new Date('2026-10-02T12:00:00Z');
      const candidates = Array.from({ length: 120 }, (_, index) => index + 1);

      const state = await service.issueSelect(OWNER, REPLACE, candidates, 'octocat', now);

      expect(state).toMatch(GITHUB_APP_STATE_PATTERN);
      expect(repo.rows[0]).toMatchObject({
        stage: 'select', purpose: 'replace', integrationUuid: TARGET_UUID, verifiedBy: 'octocat',
      });
      expect(repo.rows[0].candidateInstallationIds).toEqual(candidates.slice(0, 100));
      expect(repo.rows[0].expiresAt.getTime()).toBe(now.getTime() + GITHUB_APP_STATE_TTL_MS);
    });

    it('also purges and caps pending rows', async () => {
      for (const label of ['a', 'b', 'c', 'd', 'e']) {
        await service.issueRedirect(OWNER, { purpose: 'create', label });
      }

      await service.issueSelect(OWNER, CREATE, [1, 2], 'octocat');

      expect(repo.rows).toHaveLength(5);
      expect(repo.rows.map((row) => row.label)).not.toContain('a');
    });
  });

  describe('consume', () => {
    it('round-trips a redirect create flow and deletes the row', async () => {
      const state = await service.issueRedirect(OWNER, CREATE);

      expect(await service.consume(OWNER, state, 'redirect')).toEqual({ target: CREATE, candidates: [], verifiedBy: null });
      expect(repo.rows).toHaveLength(0);
    });

    it('round-trips a redirect replace flow', async () => {
      const state = await service.issueRedirect(OWNER, REPLACE);

      expect(await service.consume(OWNER, state, 'redirect')).toEqual({ target: REPLACE, candidates: [], verifiedBy: null });
    });

    it('round-trips a select row with its candidates', async () => {
      const state = await service.issueSelect(OWNER, CREATE, [11, 22], 'octocat');

      expect(await service.consume(OWNER, state, 'select')).toEqual({ target: CREATE, candidates: [11, 22], verifiedBy: 'octocat' });
    });

    it('rejects a replay', async () => {
      const state = await service.issueRedirect(OWNER, CREATE);
      await service.consume(OWNER, state, 'redirect');

      expectInvalidState(await rejection(service.consume(OWNER, state, 'redirect')), [state.split('.')[1]]);
    });

    it('rejects an expired state and deletes it', async () => {
      const issuedAt = new Date('2026-10-02T12:00:00Z');
      const state = await service.issueRedirect(OWNER, CREATE, issuedAt);
      const at = new Date(issuedAt.getTime() + GITHUB_APP_STATE_TTL_MS);

      expectInvalidState(await rejection(service.consume(OWNER, state, 'redirect', at)), [state.split('.')[1]]);
      expect(repo.rows).toHaveLength(0);
    });

    it('rejects an unknown state', async () => {
      const unknown = `${TARGET_UUID}.${'A'.repeat(43)}`;

      expectInvalidState(await rejection(service.consume(OWNER, unknown, 'redirect')), ['A'.repeat(43)]);
    });

    it('rejects another user\'s state and leaves it in place', async () => {
      const state = await service.issueRedirect(OWNER, CREATE);

      expectInvalidState(await rejection(service.consume(INTRUDER, state, 'redirect')), [state.split('.')[1]]);
      expect(repo.rows).toHaveLength(1);
    });

    it('rejects a wrong secret and deletes the row', async () => {
      const state = await service.issueRedirect(OWNER, CREATE);
      const [uuid, secret] = state.split('.');
      const wrong = `${uuid}.${secret.startsWith('A') ? 'B' : 'A'}${secret.slice(1)}`;

      expectInvalidState(await rejection(service.consume(OWNER, wrong, 'redirect')), [secret, wrong]);
      expect(repo.rows).toHaveLength(0);
      expectInvalidState(await rejection(service.consume(OWNER, state, 'redirect')));
    });

    it('rejects a select row on the callback, and deletes it', async () => {
      const state = await service.issueSelect(OWNER, CREATE, [1], 'octocat');

      expectInvalidState(await rejection(service.consume(OWNER, state, 'redirect')));
      expect(repo.rows).toHaveLength(0);
    });

    it('rejects a redirect row on select, and deletes it', async () => {
      const state = await service.issueRedirect(OWNER, CREATE);

      expectInvalidState(await rejection(service.consume(OWNER, state, 'select')));
      expect(repo.rows).toHaveLength(0);
    });

    it.each([
      ['an empty value', ''],
      ['no separator', TARGET_UUID],
      ['a short secret', `${TARGET_UUID}.${'A'.repeat(42)}`],
      ['padding', `${TARGET_UUID}.${'A'.repeat(42)}=`],
    ])('rejects a malformed state (%s)', async (_label, state) => {
      expectInvalidState(await rejection(service.consume(OWNER, state, 'redirect')));
    });

    it('lets exactly one of two parallel consumes succeed', async () => {
      const state = await service.issueRedirect(OWNER, CREATE);

      const results = await Promise.allSettled([
        service.consume(OWNER, state, 'redirect'),
        service.consume(OWNER, state, 'redirect'),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    });

    it.each([
      ['create without a label', { label: null }],
      ['replace without a target', { purpose: 'replace', integrationUuid: null }],
      ['an unknown purpose', { purpose: 'other' }],
    ])('rejects an inconsistent row (%s)', async (_label, patch) => {
      const state = await service.issueRedirect(OWNER, CREATE);
      Object.assign(repo.rows[0], patch);

      expectInvalidState(await rejection(service.consume(OWNER, state, 'redirect')));
    });

    it.each([
      ['no candidates', null],
      ['a non-integer candidate', [1.5]],
      ['a negative candidate', [-1]],
      ['a non-array', { id: 1 }],
    ])('rejects a select row with %s', async (_label, candidates) => {
      const state = await service.issueSelect(OWNER, CREATE, [1], 'octocat');
      repo.rows[0].candidateInstallationIds = candidates as never;

      expectInvalidState(await rejection(service.consume(OWNER, state, 'select')));
    });

    it('rejects a select row without a usable verifying login', async () => {
      const state = await service.issueSelect(OWNER, CREATE, [1], 'octocat');
      repo.rows[0].verifiedBy = null;

      expectInvalidState(await rejection(service.consume(OWNER, state, 'select')));
    });
  });
});
