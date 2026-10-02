import { inspect } from 'node:util';
import {
  GITHUB_API_VERSION,
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

    it('rethrows a body read failure as a network error', async () => {
      const response = reply(200, '{}');
      jest.spyOn(response, 'text').mockRejectedValue(new Error('socket hang up'));
      fetchMock.mockResolvedValue(response);

      expect((await thrown(service.getUser(new Secret(CANARY)))).reason).toBe('network_error');
    });
  });
});
