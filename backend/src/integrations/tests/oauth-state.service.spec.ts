import { createHash } from 'node:crypto';
import { inspect } from 'node:util';
import { HttpException } from '@nestjs/common';
import { createInMemoryOauthStateRepo, InMemoryOauthStateRepo } from './support/in-memory-oauth-states.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { Secret } from '../secret.js';
import {
  OAUTH_STATE_PATTERN,
  OAUTH_STATE_TTL_MS,
  OauthStateService,
  pkceChallenge,
} from '../types/oauth-app/oauth-state.service.js';

const OWNER = 1;
const INTRUDER = 2;
const TARGET_UUID = '0b6c1f8e-3a52-4c1b-9d5a-6f2e7c8d9a10';

/**
 * Captures what `consume` throws.
 * @param {Promise<unknown>} promise - The call.
 * @returns {Promise<HttpException>} The thrown exception.
 */
async function rejection(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    return error as HttpException;
  }

  throw new Error('expected consume to throw');
}

/**
 * Asserts an exception is the generic invalid-state 400, holding none of the given values.
 * @param {HttpException} error - The exception.
 * @param {string[]} secrets - Values that must not appear.
 * @returns {void}
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

describe('OauthStateService', () => {
  let repo: InMemoryOauthStateRepo;
  let service: OauthStateService;

  beforeEach(() => {
    repo = createInMemoryOauthStateRepo();
    service = new OauthStateService(repo as never);
  });

  describe('issue', () => {
    it('returns a well-formed state and stores only the secret hash', async () => {
      const { state } = await service.issue(OWNER, { label: 'Work' });
      const [uuid, secret] = state.split('.');

      expect(state).toMatch(OAUTH_STATE_PATTERN);
      expect(repo.rows).toHaveLength(1);
      expect(repo.rows[0]).toMatchObject({
        uuid,
        userId: OWNER,
        secretHash: createHash('sha256').update(secret).digest('hex'),
        purpose: 'create',
        label: 'Work',
        integrationUuid: null,
      });
      expect(JSON.stringify(repo.rows)).not.toContain(secret);
    });

    it('stores a replace target and an expiry 10 minutes ahead', async () => {
      const now = new Date('2026-10-02T12:00:00Z');

      await service.issue(OWNER, { integrationUuid: TARGET_UUID }, now);

      expect(repo.rows[0]).toMatchObject({ purpose: 'replace', label: null, integrationUuid: TARGET_UUID });
      expect(repo.rows[0].expiresAt.getTime()).toBe(now.getTime() + OAUTH_STATE_TTL_MS);
    });

    it('answers a challenge matching the stored 43-character verifier', async () => {
      const { codeChallenge } = await service.issue(OWNER, { label: 'Work' });
      const verifier = repo.rows[0].codeVerifier;

      expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(codeChallenge).toBe(createHash('sha256').update(verifier).digest('base64url'));
      expect(codeChallenge).toBe(pkceChallenge(verifier));
      expect(codeChallenge).not.toContain('=');
    });

    it('purges every expired row', async () => {
      const past = new Date(Date.now() - 2 * OAUTH_STATE_TTL_MS);
      await service.issue(OWNER, { label: 'Old' }, past);
      await service.issue(INTRUDER, { label: 'Old' }, past);

      await service.issue(OWNER, { label: 'New' });

      expect(repo.rows.map((row) => row.label)).toEqual(['New']);
    });

    it('keeps at most 5 pending rows per user, dropping the oldest', async () => {
      for (const label of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
        await service.issue(OWNER, { label });
      }
      await service.issue(INTRUDER, { label: 'other' });

      expect(repo.rows.filter((row) => row.userId === OWNER).map((row) => row.label)).toEqual(['c', 'd', 'e', 'f', 'g']);
      expect(repo.rows.filter((row) => row.userId === INTRUDER)).toHaveLength(1);
    });
  });

  describe('consume', () => {
    it('round-trips a create flow and deletes the row', async () => {
      const { state } = await service.issue(OWNER, { label: 'Work' });
      const verifier = repo.rows[0].codeVerifier;

      const consumed = await service.consume(OWNER, state);

      expect(consumed).toEqual({ purpose: 'create', label: 'Work', codeVerifier: expect.any(Secret) });
      expect(consumed.codeVerifier.reveal()).toBe(verifier);
      expect(inspect(consumed)).not.toContain(verifier);
      expect(repo.rows).toHaveLength(0);
    });

    it('round-trips a replace flow', async () => {
      const { state } = await service.issue(OWNER, { integrationUuid: TARGET_UUID });

      expect(await service.consume(OWNER, state)).toMatchObject({ purpose: 'replace', integrationUuid: TARGET_UUID });
    });

    it('rejects a replay', async () => {
      const { state } = await service.issue(OWNER, { label: 'Work' });
      await service.consume(OWNER, state);

      expectInvalidState(await rejection(service.consume(OWNER, state)), [state.split('.')[1]]);
    });

    it('rejects an expired state and deletes it', async () => {
      const issuedAt = new Date('2026-10-02T12:00:00Z');
      const { state } = await service.issue(OWNER, { label: 'Work' }, issuedAt);

      const error = await rejection(service.consume(OWNER, state, new Date(issuedAt.getTime() + OAUTH_STATE_TTL_MS)));

      expectInvalidState(error, [state.split('.')[1]]);
      expect(repo.rows).toHaveLength(0);
    });

    it('rejects an unknown state', async () => {
      const unknown = `${TARGET_UUID}.${'A'.repeat(43)}`;

      expectInvalidState(await rejection(service.consume(OWNER, unknown)), ['A'.repeat(43)]);
    });

    it('rejects another user\'s state and leaves it in place', async () => {
      const { state } = await service.issue(OWNER, { label: 'Work' });

      expectInvalidState(await rejection(service.consume(INTRUDER, state)), [state.split('.')[1]]);
      expect(repo.rows).toHaveLength(1);
    });

    it('rejects a wrong secret and deletes the row', async () => {
      const { state } = await service.issue(OWNER, { label: 'Work' });
      const [uuid, secret] = state.split('.');
      const wrong = `${uuid}.${secret.startsWith('A') ? 'B' : 'A'}${secret.slice(1)}`;

      expectInvalidState(await rejection(service.consume(OWNER, wrong)), [secret, wrong]);
      expect(repo.rows).toHaveLength(0);
      expectInvalidState(await rejection(service.consume(OWNER, state)));
    });

    it.each([
      ['an empty value', ''],
      ['no separator', TARGET_UUID],
      ['a short secret', `${TARGET_UUID}.${'A'.repeat(42)}`],
      ['an uppercase uuid', `${TARGET_UUID.toUpperCase()}.${'A'.repeat(43)}`],
      ['padding', `${TARGET_UUID}.${'A'.repeat(42)}=`],
    ])('rejects a malformed state (%s)', async (_label, state) => {
      expectInvalidState(await rejection(service.consume(OWNER, state)));
    });

    it('lets exactly one of two parallel consumes succeed', async () => {
      const { state } = await service.issue(OWNER, { label: 'Work' });

      const results = await Promise.allSettled([service.consume(OWNER, state), service.consume(OWNER, state)]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    });

    it('rejects an inconsistent row (create without a label)', async () => {
      const { state } = await service.issue(OWNER, { label: 'Work' });
      repo.rows[0].label = null;

      expectInvalidState(await rejection(service.consume(OWNER, state)));
    });
  });
});
