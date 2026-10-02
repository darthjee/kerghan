import { inspect } from 'node:util';
import {
  UNRECOGNIZED_OAUTH_ERROR,
  GITHUB_API_VERSION,
  GITHUB_MAX_BODY_BYTES,
  GithubClientError,
  GithubClientService,
  GITHUB_USER_AGENT,
} from '../github-client.service.js';
import { Secret } from '../secret.js';

const CANARY = 'ghp_CANARYcanary0000000000000000000000';
const CANARY_OAUTH = 'gho_CANARYcanaryOAUTH000000000000000000';
const CANARY_CODE = 'CANARYcanaryCODE0123';
const CANARY_CLIENT_SECRET = 'CANARYcanarySECRET0123456789abcdef012345';
const CANARY_VERIFIER = 'CANARYcanaryVERIFIER0123456789abcdefABCDEF';
const CLIENT_ID = 'Ov23liAbCdEf01234567';
const REDIRECT_URI = 'https://kerghan.example.com/integrations/oauth_app/callback';

/**
 * Builds a code exchange request with canary secrets.
 * @returns {Parameters<GithubClientService['exchangeOauthCode']>[0]} The request.
 */
function exchangeRequest(): Parameters<GithubClientService['exchangeOauthCode']>[0] {
  return {
    clientId: CLIENT_ID,
    clientSecret: new Secret(CANARY_CLIENT_SECRET),
    code: new Secret(CANARY_CODE),
    codeVerifier: new Secret(CANARY_VERIFIER),
    redirectUri: REDIRECT_URI,
  };
}

/**
 * Builds a revocation request with canary secrets.
 * @returns {Parameters<GithubClientService['revokeOauthToken']>[0]} The request.
 */
function revokeRequest(): Parameters<GithubClientService['revokeOauthToken']>[0] {
  return { clientId: CLIENT_ID, clientSecret: new Secret(CANARY_CLIENT_SECRET), token: new Secret(CANARY_OAUTH) };
}

/**
 * Asserts an error holds none of the canaries.
 * @param {Error} error - The error.
 * @returns {void}
 */
function expectNoCanary(error: Error): void {
  const text = `${error.message} ${error.stack ?? ''} ${JSON.stringify(error)} ${inspect(error, { depth: 10 })}`;

  expect(text).not.toContain('CANARYcanary');
}

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
      ['a login longer than 255 characters', `{"login":"${'a'.repeat(256)}"}`],
    ])('answers a null login for %s', async (_label, body) => {
      fetchMock.mockResolvedValue(reply(200, body));

      expect((await service.getUser(new Secret(CANARY))).login).toBeNull();
    });

    it('keeps a login of exactly 255 characters', async () => {
      fetchMock.mockResolvedValue(reply(200, `{"login":"${'a'.repeat(255)}"}`));

      expect((await service.getUser(new Secret(CANARY))).login).toBe('a'.repeat(255));
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
  describe('exchangeOauthCode', () => {
    it('POSTs the form-encoded exchange to github.com with Accept JSON and the User-Agent', async () => {
      fetchMock.mockResolvedValue(reply(200, '{"access_token":"x","token_type":"bearer","scope":"repo"}'));

      await service.exchangeOauthCode(exchangeRequest());

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://github.com/login/oauth/access_token');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': GITHUB_USER_AGENT,
      });
      expect(Object.fromEntries(new URLSearchParams(init.body as string))).toEqual({
        client_id: CLIENT_ID,
        client_secret: CANARY_CLIENT_SECRET,
        code: CANARY_CODE,
        redirect_uri: REDIRECT_URI,
        code_verifier: CANARY_VERIFIER,
      });
      expect(init.redirect).toBe('error');
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('wraps the access token in a Secret', async () => {
      fetchMock.mockResolvedValue(reply(200, `{"access_token":"${CANARY_OAUTH}","token_type":"bearer","scope":"repo"}`));

      const answer = await service.exchangeOauthCode(exchangeRequest());

      expect(answer.accessToken).toBeInstanceOf(Secret);
      expect(answer.accessToken?.reveal()).toBe(CANARY_OAUTH);
      expect(answer.error).toBeNull();
      expect(answer.status).toBe(200);
      expect(JSON.stringify(answer)).not.toContain(CANARY_OAUTH);
    });

    it('parses the error code and never keeps the description', async () => {
      fetchMock.mockResolvedValue(reply(200, JSON.stringify({
        error: 'bad_verification_code',
        error_description: `The code ${CANARY_CODE} is incorrect or expired.`,
        error_uri: 'https://docs.github.com',
      })));

      const answer = await service.exchangeOauthCode(exchangeRequest());

      expect(answer).toEqual({
        status: 200,
        accessToken: null,
        error: 'bad_verification_code',
        rateLimitRemaining: null,
        rateLimitReset: null,
        retryAfter: null,
      });
      expect(inspect(answer)).not.toContain('CANARYcanary');
    });

    it('replaces a free-form error value', async () => {
      fetchMock.mockResolvedValue(reply(200, JSON.stringify({ error: `Bad ${CANARY_CODE}` })));

      expect((await service.exchangeOauthCode(exchangeRequest())).error).toBe(UNRECOGNIZED_OAUTH_ERROR);
    });

    it.each([
      ['an unparseable body', 'not json'],
      ['a JSON array', '["x"]'],
      ['an empty access token', '{"access_token":""}'],
      ['a non-string access token', '{"access_token":42}'],
    ])('answers no token and no error for %s', async (_label, body) => {
      fetchMock.mockResolvedValue(reply(200, body));

      expect(await service.exchangeOauthCode(exchangeRequest())).toMatchObject({ accessToken: null, error: null });
    });

    it('answers no token for a body over the size cap', async () => {
      fetchMock.mockResolvedValue(reply(200, `{"access_token":"${'x'.repeat(GITHUB_MAX_BODY_BYTES)}"}`));

      expect((await service.exchangeOauthCode(exchangeRequest())).accessToken).toBeNull();
    });

    it('normalises the status and rate-limit headers', async () => {
      fetchMock.mockResolvedValue(reply(429, '{}', { 'Retry-After': '30', 'X-RateLimit-Remaining': '0' }));

      expect(await service.exchangeOauthCode(exchangeRequest())).toMatchObject({
        status: 429,
        retryAfter: 30,
        rateLimitRemaining: 0,
      });
    });

    it.each([
      ['timeout', new DOMException('aborted due to timeout', 'TimeoutError')],
      ['network_error', new TypeError(`fetch failed ${CANARY_CLIENT_SECRET} ${CANARY_CODE}`)],
    ])('rethrows a %s as a sanitized error without the canaries', async (reason, failure) => {
      fetchMock.mockRejectedValue(failure);

      const error = await thrown(service.exchangeOauthCode(exchangeRequest()));

      expect(error).toBeInstanceOf(GithubClientError);
      expect(error.reason).toBe(reason);
      expectNoCanary(error);
    });
  });

  describe('revokeOauthToken', () => {
    it('DELETEs the single token with HTTP Basic app credentials, never the grant', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

      expect(await service.revokeOauthToken(revokeRequest())).toEqual({ status: 204 });

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`https://api.github.com/applications/${CLIENT_ID}/token`);
      expect(url).not.toContain('grant');
      expect(init.method).toBe('DELETE');
      expect(init.headers).toEqual({
        Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CANARY_CLIENT_SECRET}`).toString('base64')}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
        'User-Agent': GITHUB_USER_AGENT,
        'Content-Type': 'application/json',
      });
      expect(JSON.parse(init.body as string)).toEqual({ access_token: CANARY_OAUTH });
      expect(init.redirect).toBe('error');
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('answers GitHub\'s status on failures', async () => {
      fetchMock.mockResolvedValue(reply(422, '{"message":"Validation Failed"}'));

      expect(await service.revokeOauthToken(revokeRequest())).toEqual({ status: 422 });
    });

    it.each([
      ['timeout', new DOMException('aborted due to timeout', 'TimeoutError')],
      ['network_error', new TypeError(`fetch failed ${CANARY_CLIENT_SECRET} ${CANARY_OAUTH}`)],
    ])('rethrows a %s as a sanitized error without the canaries', async (reason, failure) => {
      fetchMock.mockRejectedValue(failure);

      const error = await thrown(service.revokeOauthToken(revokeRequest()));

      expect(error.reason).toBe(reason);
      expectNoCanary(error);
    });
  });
});
