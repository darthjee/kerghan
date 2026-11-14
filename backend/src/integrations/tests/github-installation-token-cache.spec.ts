import { inspect } from 'node:util';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { LoggerService } from '../../core/logger.service.js';
import type { Integration } from '../entities/integration.entity.js';
import { GithubInstallationTokenCache, INSTALLATION_TOKEN_EXPIRY_MARGIN_MS } from '../github-installation-token-cache.js';
import { IntegrationLifecycleService } from '../integration-lifecycle.service.js';
import { githubRepo, jsonResponse, listingPage, replyOnce, unauthorized } from './support/github-builders.js';
import {
  buildGithubServiceHarness,
  CANARY,
  CANARY_INSTALLATION_TOKEN,
  GithubServiceHarness,
  START,
} from './support/integrations-github-harness.js';
import { deferred, fetchCalls, fetchMock, installNoNetworkGuard } from './support/no-network-guard.js';

const USER = 1;
const HOUR = 3_600_000;
const MINT_PATH = '/app/installations/4242/access_tokens';

/**
 * A mint `201`.
 * @param {string} [token] - The minted token.
 * @param {number} [lifetimeMs] - How long it lives from `START`.
 * @returns {Response} The response.
 */
function minted(token: string = CANARY_INSTALLATION_TOKEN, lifetimeMs: number = HOUR): Response {
  return jsonResponse(201, { token, expires_at: new Date(START.getTime() + lifetimeMs).toISOString() });
}

/**
 * The paths of the fetch calls so far.
 * @returns {string[]} The paths.
 */
function paths(): string[] {
  return fetchCalls().map(({ url }) => new URL(url).pathname);
}

/**
 * Number of mints so far.
 * @returns {number} The count.
 */
function mints(): number {
  return paths().filter((path) => path === MINT_PATH).length;
}

describe('GitHub App installation tokens', () => {
  installNoNetworkGuard();

  let harness: GithubServiceHarness;
  let row: Integration;
  const list = (): ReturnType<GithubServiceHarness['service']['listRepositories']> =>
    harness.service.listRepositories(USER, row.id, 1);
  const okPage = (): void => replyOnce(fetchMock(), listingPage(1, [githubRepo()]), 'installation');
  const stored = (): Integration => harness.repo.rows.find((candidate) => candidate.id === row.id) as Integration;

  beforeEach(async () => {
    harness = buildGithubServiceHarness();
    row = await harness.seed({ type: 'github_app' });
  });

  it('mints with {"permissions":{"metadata":"read"}} only, then lists /installation/repositories with it', async () => {
    fetchMock().mockResolvedValueOnce(minted());
    okPage();

    expect(await list()).toMatchObject({ kind: 'ok' });
    expect(paths()).toEqual([MINT_PATH, '/installation/repositories']);
    expect(fetchCalls()[0].init.body).toBe('{"permissions":{"metadata":"read"}}');
    expect(fetchCalls()[1].headers.Authorization).toBe(`Bearer ${CANARY_INSTALLATION_TOKEN}`);
  });

  it('serves concurrent calls with one mint (deferred fetch reply)', async () => {
    const mint = deferred<Response>();

    fetchMock().mockImplementationOnce(() => mint.promise);
    fetchMock().mockImplementation(async (url: string) => {
      const page = listingPage(1, [githubRepo()]).raw as (shape: 'array' | 'installation') => Response;

      return page(url.includes('/installation/') ? 'installation' : 'array');
    });

    const calls = [list(), list(), harness.service.listHandleRepositories(USER, row.id, 'octocat', 1)];

    await new Promise(setImmediate);
    mint.resolve(minted());

    expect((await Promise.all(calls)).map(({ kind }) => kind)).toEqual(['ok', 'ok', 'ok']);
    expect(mints()).toBe(1);
  });

  it('reuses a cached token until expires_at − 5 min on the FakeClock', async () => {
    fetchMock().mockResolvedValueOnce(minted());
    okPage();
    await list();

    harness.clock.set(new Date(START.getTime() + HOUR - INSTALLATION_TOKEN_EXPIRY_MARGIN_MS - 1));
    okPage();
    await list();
    expect(mints()).toBe(1);

    harness.clock.set(new Date(START.getTime() + HOUR - INSTALLATION_TOKEN_EXPIRY_MARGIN_MS));
    fetchMock().mockResolvedValueOnce(minted('ghs_CANARYcanarySECOND', 2 * HOUR));
    okPage();
    await list();
    expect(mints()).toBe(2);
  });

  it('on a 401 with a cached token, evicts it, mints once and retries once', async () => {
    fetchMock().mockResolvedValueOnce(minted());
    okPage();
    await list();

    replyOnce(fetchMock(), unauthorized());
    fetchMock().mockResolvedValueOnce(minted('ghs_CANARYcanaryNEW'));
    okPage();

    expect(await list()).toMatchObject({ kind: 'ok' });
    expect(paths().slice(2)).toEqual(['/installation/repositories', MINT_PATH, '/installation/repositories']);
    expect(fetchCalls()[4].headers.Authorization).toBe('Bearer ghs_CANARYcanaryNEW');
    expect(stored().status).toBe('active');
  });

  it('answers unavailable after the retry also gets a 401, status unchanged', async () => {
    fetchMock().mockResolvedValueOnce(minted());
    okPage();
    await list();

    replyOnce(fetchMock(), unauthorized());
    fetchMock().mockResolvedValueOnce(minted());
    replyOnce(fetchMock(), unauthorized());

    expect(await list()).toEqual({ kind: 'unavailable', reason: 'unexpected' });
    expect(fetchCalls()).toHaveLength(5);
    expect(stored().status).toBe('active');
  });

  it('answers unavailable on a 401 with a freshly minted token, without a retry or a status change', async () => {
    fetchMock().mockResolvedValueOnce(minted());
    replyOnce(fetchMock(), unauthorized());

    expect(await list()).toEqual({ kind: 'unavailable', reason: 'unexpected' });
    expect(fetchCalls()).toHaveLength(2);
    expect(stored()).toMatchObject({ status: 'active', statusReason: null });
    expect(harness.logger.warn).toHaveBeenCalledWith('github app fresh installation token rejected', {
      integrationId: row.id,
      operation: 'list_repositories',
      status: 401,
      result: 'unavailable',
    });
  });

  describe('eviction on delete and replace', () => {
    let lifecycle: IntegrationLifecycleService;

    beforeEach(async () => {
      lifecycle = new IntegrationLifecycleService(
        harness.tokens,
        { emitAsync: jest.fn().mockResolvedValue([]) } as unknown as EventEmitter2,
        harness.logger as unknown as LoggerService,
      );
      fetchMock().mockResolvedValueOnce(minted());
      okPage();
      await list();
    });

    it('re-mints after a credential replacement', async () => {
      lifecycle.credentialReplaced(row);
      fetchMock().mockResolvedValueOnce(minted());
      okPage();
      await list();

      expect(mints()).toBe(2);
    });

    it('re-mints after a delete', async () => {
      await lifecycle.deleted(row);
      fetchMock().mockResolvedValueOnce(minted());
      okPage();
      await list();

      expect(mints()).toBe(2);
    });

    it('re-mints after the stored credential changed, even without an eviction', async () => {
      harness.replace(row);
      fetchMock().mockResolvedValueOnce(minted());
      okPage();
      await list();

      expect(mints()).toBe(2);
    });
  });

  it('does not cache a mint in flight across a Replace; the next call mints with the new credential', async () => {
    const mint = deferred<Response>();

    fetchMock().mockImplementationOnce(() => mint.promise);
    okPage();
    const first = list();

    await new Promise(setImmediate);
    harness.replace(row);
    mint.resolve(minted());

    expect(await first).toMatchObject({ kind: 'ok' });

    fetchMock().mockResolvedValueOnce(minted('ghs_CANARYcanaryAFTER'));
    okPage();
    await list();

    expect(mints()).toBe(2);
    expect(fetchCalls()[3].headers.Authorization).toBe('Bearer ghs_CANARYcanaryAFTER');
  });

  it('does not cache a mint in flight across an eviction', async () => {
    const mint = deferred<Response>();

    fetchMock().mockImplementationOnce(() => mint.promise);
    okPage();
    const first = list();

    await new Promise(setImmediate);
    harness.tokens.evict(row.id);
    mint.resolve(minted());
    await first;

    fetchMock().mockResolvedValueOnce(minted());
    okPage();
    await list();

    expect(mints()).toBe(2);
  });

  describe('mint failures', () => {
    it.each([
      [404, 'uninstalled'],
      [403, 'suspended'],
    ])('a mint %i sets the integration invalid + %s and answers invalid_credentials', async (status, reason) => {
      fetchMock().mockResolvedValueOnce(jsonResponse(status, { message: `${CANARY}BODY` }));

      expect(await list()).toEqual({ kind: 'invalid_credentials' });
      expect(stored()).toMatchObject({ status: 'invalid', statusReason: reason });
      expect(paths()).toEqual([MINT_PATH]);
    });

    it('an app-JWT 401 leaves the status unchanged and logs at error level', async () => {
      fetchMock().mockResolvedValueOnce(jsonResponse(401, {}));

      expect(await list()).toEqual({ kind: 'unavailable', reason: 'unexpected' });
      expect(stored().status).toBe('active');
      expect(harness.logger.error).toHaveBeenCalledWith('github app jwt rejected on installation token mint', {
        integrationId: row.id,
        operation: 'list_repositories',
        status: 401,
        result: 'unavailable',
      });
    });

    it.each([
      ['5xx', () => jsonResponse(502, {}), { kind: 'unavailable', reason: 'server_error' }],
      ['rate limit', () => jsonResponse(403, {}, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1767229800' }),
        { kind: 'rate_limited', resetAt: new Date(1_767_229_800_000) }],
    ])('a mint %s leaves the status unchanged', async (_name, response, expected) => {
      fetchMock().mockResolvedValueOnce(response());

      expect(await list()).toEqual(expected);
      expect(stored().status).toBe('active');
    });

    it('a mint timeout answers unavailable (timeout)', async () => {
      fetchMock().mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'));

      expect(await list()).toEqual({ kind: 'unavailable', reason: 'timeout' });
    });
  });

  it('never lets a cached token leave the module: no getter, no log line, no result field', async () => {
    fetchMock().mockResolvedValueOnce(minted());
    okPage();
    const result = await list();

    expect(Object.getOwnPropertyNames(GithubInstallationTokenCache.prototype).sort()).toEqual(['acquire', 'constructor', 'evict']);
    expect(JSON.stringify(result)).not.toContain(CANARY);
    expect(inspect(harness.tokens, { depth: 10 })).not.toContain(CANARY);
    expect(JSON.stringify(Object.values(harness.logger).map((mock) => mock.mock.calls))).not.toContain(CANARY);
  });
});
