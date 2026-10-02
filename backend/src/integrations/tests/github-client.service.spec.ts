import { inspect } from 'node:util';
import {
  GITHUB_API_VERSION,
  GITHUB_MAX_BODY_BYTES,
  GithubClientError,
  GithubClientService,
  GITHUB_USER_AGENT,
} from '../github-client.service.js';
import { Secret } from '../secret.js';

const CANARY = 'ghp_CANARYcanary0000000000000000000000';

/**
 * Builds a fetch `Response`.
 * @param {number} status - The HTTP status.
 * @param {string} body - The body text.
 * @param {Record<string, string>} headers - The response headers.
 * @returns {Response} The response.
 */
function reply(status: number, body: string, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers });
}

/**
 * Captures what `getUser` throws.
 * @param {Promise<unknown>} promise - The call.
 * @returns {Promise<GithubClientError>} The thrown error.
 */
async function thrown(promise: Promise<unknown>): Promise<GithubClientError> {
  try {
    await promise;
  } catch (error) {
    return error as GithubClientError;
  }

  throw new Error('expected getUser to throw');
}

describe('GithubClientService', () => {
  let service: GithubClientService;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    service = new GithubClientService();
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getUser', () => {
    it('sends GET /user with the bearer token, Accept, API version and User-Agent headers', async () => {
      fetchMock.mockResolvedValue(reply(200, '{"login":"octocat"}'));

      await service.getUser(new Secret(CANARY));

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.github.com/user');
      expect(init.method).toBe('GET');
      expect(init.headers).toEqual({
        Authorization: `Bearer ${CANARY}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
        'User-Agent': GITHUB_USER_AGENT,
      });
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('refuses redirects, so the token is only ever sent to api.github.com', async () => {
      fetchMock.mockResolvedValue(reply(200, '{"login":"octocat"}'));

      await service.getUser(new Secret(CANARY));

      expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].redirect).toBe('error');
    });

    it('rethrows a refused redirect as a network error', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed', { cause: new Error('unexpected redirect') }));

      expect((await thrown(service.getUser(new Secret(CANARY)))).reason).toBe('network_error');
    });

    it('parses the login and the normalised headers', async () => {
      fetchMock.mockResolvedValue(reply(200, '{"login":"octocat","id":1}', {
        'X-OAuth-Scopes': 'repo, read:org',
        'GitHub-Authentication-Token-Expiration': '2026-11-01 00:00:00 UTC',
        'X-RateLimit-Remaining': '4999',
        'X-RateLimit-Reset': '1790000000',
      }));

      expect(await service.getUser(new Secret(CANARY))).toEqual({
        status: 200,
        login: 'octocat',
        oauthScopes: 'repo, read:org',
        tokenExpiration: '2026-11-01 00:00:00 UTC',
        rateLimitRemaining: 4999,
        rateLimitReset: 1790000000,
        retryAfter: null,
      });
    });

    it('answers nulls for absent headers', async () => {
      fetchMock.mockResolvedValue(reply(200, '{"login":"octocat"}'));

      expect(await service.getUser(new Secret(CANARY))).toMatchObject({
        oauthScopes: null,
        tokenExpiration: null,
        rateLimitRemaining: null,
        rateLimitReset: null,
        retryAfter: null,
      });
    });

    it('reads Retry-After and ignores non-numeric rate-limit headers', async () => {
      fetchMock.mockResolvedValue(reply(429, '{"message":"slow down"}', {
        'Retry-After': '60',
        'X-RateLimit-Remaining': 'lots',
        'X-RateLimit-Reset': ' ',
      }));

      expect(await service.getUser(new Secret(CANARY))).toMatchObject({
        status: 429,
        login: null,
        retryAfter: 60,
        rateLimitRemaining: null,
        rateLimitReset: null,
      });
    });

    it('never reads a login off a non-200 answer', async () => {
      fetchMock.mockResolvedValue(reply(401, '{"login":"octocat"}'));

      expect(await service.getUser(new Secret(CANARY))).toMatchObject({ status: 401, login: null });
    });

    it.each([
      ['an unparseable body', 'not json'],
      ['a missing login', '{"id":1}'],
      ['an empty login', '{"login":""}'],
      ['a non-string login', '{"login":42}'],
    ])('answers a null login for %s', async (_label, body) => {
      fetchMock.mockResolvedValue(reply(200, body));

      expect((await service.getUser(new Secret(CANARY))).login).toBeNull();
    });

    it('rethrows a timeout as a sanitized error', async () => {
      fetchMock.mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));

      const error = await thrown(service.getUser(new Secret(CANARY)));

      expect(error).toBeInstanceOf(GithubClientError);
      expect(error.reason).toBe('timeout');
      expect(error.status).toBeNull();
    });

    it('rethrows an abort as a timeout', async () => {
      fetchMock.mockRejectedValue(new DOMException('aborted', 'AbortError'));

      expect((await thrown(service.getUser(new Secret(CANARY)))).reason).toBe('timeout');
    });

    it('rethrows a network error as a sanitized error without the token, headers or cause', async () => {
      const original = Object.assign(new TypeError(`fetch failed for Bearer ${CANARY}`), {
        cause: { headers: { Authorization: `Bearer ${CANARY}` } },
      });
      fetchMock.mockRejectedValue(original);

      const error = await thrown(service.getUser(new Secret(CANARY)));

      expect(error).toBeInstanceOf(GithubClientError);
      expect(error.reason).toBe('network_error');
      expect(error.cause).toBeUndefined();
      expect(error.message).not.toContain(CANARY);
      expect(error.stack).not.toContain(CANARY);
      expect(JSON.stringify(error)).not.toContain(CANARY);
      expect(inspect(error, { depth: 10 })).not.toContain(CANARY);
      expect(inspect(error, { depth: 10 })).not.toContain('Authorization');
    });

    it('rethrows a non-Error rejection as a network error', async () => {
      fetchMock.mockRejectedValue(CANARY);

      const error = await thrown(service.getUser(new Secret(CANARY)));

      expect(error.reason).toBe('network_error');
      expect(inspect(error)).not.toContain(CANARY);
    });

    it('reads a body of exactly the size cap', async () => {
      const body = `{"login":"octocat","pad":"${'x'.repeat(GITHUB_MAX_BODY_BYTES - 28)}"}`;
      expect(Buffer.byteLength(body)).toBe(GITHUB_MAX_BODY_BYTES);
      fetchMock.mockResolvedValue(reply(200, body));

      expect((await service.getUser(new Secret(CANARY))).login).toBe('octocat');
    });

    it.each([
      ['a cancel that succeeds', jest.fn()],
      ['a cancel that fails', jest.fn().mockRejectedValue(new Error('already closed'))],
    ])('stops reading a body over the size cap and answers a null login, with %s', async (_label, cancel) => {
      let sent = 0;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          sent += 1;
          controller.enqueue(new TextEncoder().encode(sent === 1 ? '{"login":"octocat","pad":"' : 'x'.repeat(16 * 1024)));
        },
        cancel,
      });
      fetchMock.mockResolvedValue(new Response(stream, { status: 200, headers: { 'X-OAuth-Scopes': 'repo' } }));

      expect(await service.getUser(new Secret(CANARY))).toMatchObject({ status: 200, login: null, oauthScopes: 'repo' });
      expect(cancel).toHaveBeenCalled();
      expect(sent).toBeLessThan(10);
    });

    it('answers a null login for a 200 without a body', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

      expect((await service.getUser(new Secret(CANARY))).login).toBeNull();
    });

    it('rethrows a body read failure as a network error', async () => {
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.error(new Error('socket hang up'));
        },
      });
      fetchMock.mockResolvedValue(new Response(stream, { status: 200 }));

      expect((await thrown(service.getUser(new Secret(CANARY)))).reason).toBe('network_error');
    });
  });
});
