import { FakeClock } from '../../core/tests/support/fake-clock.js';
import { GITHUB_API_VERSION } from '../github-client.service.js';
import { hasNextLink } from '../github-http.js';
import {
  GITHUB_REPO_LISTING_MAX_BODY_BYTES,
  GITHUB_REPO_MAX_BODY_BYTES,
  GithubRepoClientService,
} from '../github-repo-client.service.js';
import { classifyRepoResponse, parseMintedToken, type RepoOperation } from '../github-repo-response.js';
import { Secret } from '../secret.js';
import {
  DEFAULT_RATE_LIMIT,
  githubRepo,
  jsonResponse,
  rateLimitHeaders,
  rawRepo,
} from './support/github-builders.js';
import { fetchCalls, fetchMock, installNoNetworkGuard } from './support/no-network-guard.js';

const TOKEN = new Secret('ghp_CANARYcanaryCLIENT00000000000000000a1b2');
const START = new Date('2026-01-01T00:00:00Z');

describe('GithubRepoClientService', () => {
  installNoNetworkGuard();

  let clock: FakeClock;
  let client: GithubRepoClientService;

  beforeEach(() => {
    clock = new FakeClock(START);
    client = new GithubRepoClientService(clock);
  });

  describe('requests', () => {
    beforeEach(() => {
      fetchMock().mockImplementation(async () =>
        jsonResponse(200, [], { link: '<https://api.github.com/user/repos?page=2>; rel="next"' }));
    });

    it.each([
      ['listUserRepos', () => client.listUserRepos(TOKEN, 1),
        'https://api.github.com/user/repos?affiliation=owner,collaborator,organization_member&visibility=all&sort=created&direction=asc&per_page=100&page=1'],
      ['listInstallationRepos', () => client.listInstallationRepos(TOKEN, 3),
        'https://api.github.com/installation/repositories?per_page=100&page=3'],
      ['listHandleRepos', () => client.listHandleRepos(TOKEN, 'octocat', 2),
        'https://api.github.com/users/octocat/repos?type=owner&sort=created&direction=asc&per_page=100&page=2'],
      ['getRepositoryById', () => client.getRepositoryById(TOKEN, 2 ** 40),
        `https://api.github.com/repositories/${2 ** 40}`],
    ])('%s calls exactly its fixed endpoint with GET and redirect: manual', async (_name, call, url) => {
      await call();

      const [only] = fetchCalls();

      expect(fetchCalls()).toHaveLength(1);
      expect(only.url).toBe(url);
      expect(only.init.method).toBe('GET');
      expect(only.init.redirect).toBe('manual');
      expect(only.headers).toMatchObject({
        Authorization: `Bearer ${TOKEN.reveal()}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      });
    });

    it('builds every page URL itself, never requesting the Link URL (same-origin included)', async () => {
      const first = await client.listUserRepos(TOKEN, 1);
      const second = await client.listUserRepos(TOKEN, 2);

      expect(first.result).toMatchObject({ kind: 'ok', hasNext: true });
      expect(second.result).toMatchObject({ kind: 'ok', hasNext: true });
      expect(fetchCalls().map(({ url }) => new URL(url).searchParams.get('page'))).toEqual(['1', '2']);
      expect(fetchCalls().map(({ url }) => url)).not.toContain('https://api.github.com/user/repos?page=2');
    });

    it('targets only https://api.github.com', async () => {
      await client.listUserRepos(TOKEN, 1);
      await client.listHandleRepos(null, 'octocat', 1);
      await client.getRepositoryById(null, 1);

      fetchCalls().forEach(({ url }) => expect(new URL(url).origin).toBe('https://api.github.com'));
    });

    it('sends no Authorization header without a token', async () => {
      await client.listHandleRepos(null, 'octocat', 1);
      await client.getRepositoryById(null, 5);

      fetchCalls().forEach(({ headers }) => {
        expect(Object.keys(headers).map((name) => name.toLowerCase())).not.toContain('authorization');
        expect(headers['User-Agent']).toBe('kerghan');
      });
    });

    it('URL-encodes the handle in the path', async () => {
      await client.listHandleRepos(null, 'a/../b?x=1#y', 1);

      expect(fetchCalls()[0].url)
        .toBe('https://api.github.com/users/a%2F..%2Fb%3Fx%3D1%23y/repos?type=owner&sort=created&direction=asc&per_page=100&page=1');
    });

    it('sends a passed etag as If-None-Match, and none otherwise', async () => {
      await client.listUserRepos(TOKEN, 1, 'W/"abc"');
      await client.listUserRepos(TOKEN, 1);

      expect(fetchCalls()[0].headers['If-None-Match']).toBe('W/"abc"');
      expect(fetchCalls()[1].headers['If-None-Match']).toBeUndefined();
    });

    it('refuses a non-positive page or githubId without a call', async () => {
      expect(() => client.listUserRepos(TOKEN, 0)).toThrow(RangeError);
      await expect(client.getRepositoryById(TOKEN, -1)).rejects.toThrow(RangeError);
      expect(fetchCalls()).toHaveLength(0);
    });
  });

  describe('bodies', () => {
    it('maps the four fields only, and returns the ETag, hasNext and rate-limit fields', async () => {
      const repo = githubRepo({ private: true });

      fetchMock().mockResolvedValueOnce(jsonResponse(200, [rawRepo(repo)], { etag: 'W/"e1"' }));

      expect((await client.listUserRepos(TOKEN, 1)).result).toEqual({
        kind: 'ok',
        repos: [repo],
        etag: 'W/"e1"',
        hasNext: false,
        rateLimit: DEFAULT_RATE_LIMIT,
      });
    });

    it('reads the installation listing from { repositories }', async () => {
      const repo = githubRepo();

      fetchMock().mockResolvedValueOnce(jsonResponse(200, { total_count: 1, repositories: [rawRepo(repo)] }));

      expect((await client.listInstallationRepos(TOKEN, 1)).result).toMatchObject({ kind: 'ok', repos: [repo] });
    });

    it('drops malformed entries', async () => {
      const good = githubRepo();
      const entries = [
        rawRepo(good),
        { ...rawRepo(githubRepo()), id: 0 },
        { ...rawRepo(githubRepo()), id: 2 ** 53 },
        { ...rawRepo(githubRepo()), id: 1.5 },
        { ...rawRepo(githubRepo()), id: '12' },
        { ...rawRepo(githubRepo()), owner: { login: 'x'.repeat(40) } },
        { ...rawRepo(githubRepo()), owner: null },
        { ...rawRepo(githubRepo()), name: 'n'.repeat(101) },
        { ...rawRepo(githubRepo()), name: '' },
        { ...rawRepo(githubRepo()), private: 'false' },
        null,
        'repo',
      ];

      fetchMock().mockResolvedValueOnce(jsonResponse(200, entries));

      expect((await client.listUserRepos(TOKEN, 1)).result).toMatchObject({ kind: 'ok', repos: [good] });
    });

    it.each([
      ['a non-array listing', () => client.listUserRepos(TOKEN, 1), { repositories: [] }],
      ['an installation body without repositories', () => client.listInstallationRepos(TOKEN, 1), []],
      ['a malformed repository', () => client.getRepositoryById(TOKEN, 1), { id: 'x' }],
    ])('answers unavailable (unexpected) for %s', async (_name, call, body) => {
      fetchMock().mockResolvedValueOnce(jsonResponse(200, body));

      expect((await call()).result).toEqual({ kind: 'unavailable', reason: 'unexpected' });
    });

    it('answers unavailable (unexpected) for a non-JSON body', async () => {
      fetchMock().mockResolvedValueOnce(new Response('not json', { status: 200 }));

      expect((await client.listUserRepos(TOKEN, 1)).result).toEqual({ kind: 'unavailable', reason: 'unexpected' });
    });

    it('answers unavailable (unexpected) for a listing body over 2 MiB', async () => {
      fetchMock().mockResolvedValueOnce(new Response('x'.repeat(GITHUB_REPO_LISTING_MAX_BODY_BYTES + 1), { status: 200 }));

      expect((await client.listUserRepos(TOKEN, 1)).result).toEqual({ kind: 'unavailable', reason: 'unexpected' });
    });

    it('answers unavailable (unexpected) for a repository body over 64 KiB', async () => {
      fetchMock().mockResolvedValueOnce(new Response('x'.repeat(GITHUB_REPO_MAX_BODY_BYTES + 1), { status: 200 }));

      expect((await client.getRepositoryById(TOKEN, 1)).result).toEqual({ kind: 'unavailable', reason: 'unexpected' });
    });

    it('reads a listing body just under the 2 MiB cap', async () => {
      const repo = githubRepo();
      const body = JSON.stringify([rawRepo(repo)]);
      const padded = `${body.slice(0, -1)}${' '.repeat(GITHUB_REPO_LISTING_MAX_BODY_BYTES - body.length)}]`;

      fetchMock().mockResolvedValueOnce(new Response(padded, { status: 200 }));

      expect((await client.listUserRepos(TOKEN, 1)).result).toMatchObject({ kind: 'ok', repos: [repo] });
    });
  });

  describe('error mapping', () => {
    const listing = (): Promise<{ result: unknown }> => client.listUserRepos(TOKEN, 1, 'W/"x"');
    const handle = (): Promise<{ result: unknown }> => client.listHandleRepos(TOKEN, 'octocat', 1);
    const repository = (): Promise<{ result: unknown }> => client.getRepositoryById(TOKEN, 1);

    it.each([
      ['304 on a listing', listing, () => new Response(null, { status: 304, headers: rateLimitHeaders() }),
        { kind: 'not_modified', rateLimit: DEFAULT_RATE_LIMIT }],
      ['304 on getRepository', repository, () => new Response(null, { status: 304 }),
        { kind: 'unavailable', reason: 'unexpected' }],
      ['401 authenticated', listing, () => jsonResponse(401, {}), { kind: 'invalid_credentials' }],
      ['other 403 on a listing', listing, () => jsonResponse(403, {}), { kind: 'unavailable', reason: 'forbidden' }],
      ['other 403 on getRepository', repository, () => jsonResponse(403, {}), { kind: 'not_found' }],
      ['404 on getRepository', repository, () => jsonResponse(404, {}), { kind: 'not_found' }],
      ['404 on the handle listing', handle, () => jsonResponse(404, {}), { kind: 'not_found' }],
      ['404 on another listing', listing, () => jsonResponse(404, {}), { kind: 'unavailable', reason: 'unexpected' }],
      ['301 same-origin', listing,
        () => new Response(null, { status: 301, headers: { location: 'https://api.github.com/user/repos' } }),
        { kind: 'unavailable', reason: 'redirect' }],
      ['302', repository,
        () => new Response(null, { status: 302, headers: { location: 'https://api.github.com/repositories/2' } }),
        { kind: 'unavailable', reason: 'redirect' }],
      ['307', handle, () => new Response(null, { status: 307 }), { kind: 'unavailable', reason: 'redirect' }],
      ['500', listing, () => jsonResponse(500, {}), { kind: 'unavailable', reason: 'server_error' }],
      ['503', repository, () => jsonResponse(503, {}), { kind: 'unavailable', reason: 'server_error' }],
      ['422', listing, () => jsonResponse(422, {}), { kind: 'unavailable', reason: 'unexpected' }],
      ['201', listing, () => jsonResponse(201, []), { kind: 'unavailable', reason: 'unexpected' }],
    ])('maps %s', async (_name, call, response, expected) => {
      fetchMock().mockResolvedValueOnce(response());

      expect((await call()).result).toEqual(expected);
    });

    it('maps a 401 without a credential to unavailable (unexpected)', async () => {
      fetchMock().mockResolvedValueOnce(jsonResponse(401, {}));

      expect((await client.getRepositoryById(null, 1)).result).toEqual({ kind: 'unavailable', reason: 'unexpected' });
    });

    it.each([403, 429])('maps a %i with X-RateLimit-Remaining: 0 to rate_limited at X-RateLimit-Reset', async (status) => {
      fetchMock().mockResolvedValueOnce(jsonResponse(status, {}, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1767229800' }));

      expect((await listing()).result).toEqual({ kind: 'rate_limited', resetAt: new Date(1_767_229_800_000) });
    });

    it.each([403, 429])('maps a %i with Retry-After to rate_limited at now + Retry-After (FakeClock)', async (status) => {
      clock.advance(5_000);
      fetchMock().mockResolvedValueOnce(jsonResponse(status, {}, { 'retry-after': '60' }));

      expect((await repository()).result).toEqual({ kind: 'rate_limited', resetAt: new Date(START.getTime() + 65_000) });
    });

    it('answers rate_limited with a null resetAt when GitHub gave no reset', async () => {
      fetchMock().mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'x-ratelimit-remaining': '0' } }));

      expect((await listing()).result).toEqual({ kind: 'rate_limited', resetAt: null });
    });

    it('detects rate limits from headers only, never from the body', async () => {
      fetchMock().mockResolvedValueOnce(jsonResponse(403, { message: 'API rate limit exceeded' }));

      expect((await listing()).result).toEqual({ kind: 'unavailable', reason: 'forbidden' });
    });

    it.each([
      ['timeout', new DOMException('timed out', 'TimeoutError'), 'timeout'],
      ['network failure', new TypeError('fetch failed'), 'network_error'],
    ])('maps a %s to unavailable', async (_name, error, reason) => {
      fetchMock().mockRejectedValueOnce(error);

      expect(await listing()).toEqual({ result: { kind: 'unavailable', reason }, rateLimit: null, status: null });
    });

    it('never follows a 3xx: one fetch call, with redirect: manual', async () => {
      fetchMock().mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: 'https://evil.example.com/' } }));

      await listing();

      expect(fetchCalls()).toHaveLength(1);
      expect(fetchCalls()[0].init.redirect).toBe('manual');
    });
  });

  describe('mintInstallationToken', () => {
    const JWT = new Secret('CANARYcanaryJWT');

    it('POSTs with exactly {"permissions":{"metadata":"read"}} and parses the token into a Secret', async () => {
      fetchMock().mockResolvedValueOnce(jsonResponse(201, { token: 'ghs_CANARYcanaryMINT', expires_at: '2026-01-01T01:00:00Z' }));

      const minted = await client.mintInstallationToken(JWT, 77);
      const [call] = fetchCalls();

      expect(call.url).toBe('https://api.github.com/app/installations/77/access_tokens');
      expect(call.init.method).toBe('POST');
      expect(call.init.body).toBe('{"permissions":{"metadata":"read"}}');
      expect(call.init.redirect).toBe('manual');
      expect(call.headers.Authorization).toBe('Bearer CANARYcanaryJWT');
      expect(minted).toEqual({ kind: 'ok', token: expect.any(Secret), expiresAt: new Date('2026-01-01T01:00:00Z') });
      expect(JSON.stringify(minted)).not.toContain('CANARYcanary');
    });

    it.each([
      [404, {}, { kind: 'uninstalled' }],
      [403, {}, { kind: 'suspended' }],
      [401, {}, { kind: 'jwt_rejected' }],
      [403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1767229800' },
        { kind: 'rate_limited', resetAt: new Date(1_767_229_800_000) }],
      [500, {}, { kind: 'unavailable', reason: 'server_error' }],
      [302, {}, { kind: 'unavailable', reason: 'redirect' }],
      [422, {}, { kind: 'unavailable', reason: 'unexpected' }],
    ])('maps a mint %i', async (status, headers, expected) => {
      fetchMock().mockResolvedValueOnce(jsonResponse(status, {}, headers as Record<string, string>));

      expect(await client.mintInstallationToken(JWT, 77)).toEqual(expected);
    });

    it('maps a mint timeout', async () => {
      fetchMock().mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'));

      expect(await client.mintInstallationToken(JWT, 77)).toEqual({ kind: 'unavailable', reason: 'timeout' });
    });

    it.each([
      ['no token', { expires_at: '2026-01-01T01:00:00Z' }],
      ['an empty token', { token: '', expires_at: '2026-01-01T01:00:00Z' }],
      ['no expiry', { token: 'ghs_x' }],
      ['a bad expiry', { token: 'ghs_x', expires_at: 'soon' }],
    ])('answers unavailable (unexpected) for a 201 with %s', async (_name, body) => {
      fetchMock().mockResolvedValueOnce(jsonResponse(201, body));

      expect(await client.mintInstallationToken(JWT, 77)).toEqual({ kind: 'unavailable', reason: 'unexpected' });
    });

    it('parses an over-cap mint body as unexpected', () => {
      expect(parseMintedToken(null)).toEqual({ kind: 'unavailable', reason: 'unexpected' });
    });
  });
});

describe('classifyRepoResponse', () => {
  const clock = new FakeClock(START);
  const none = { rateLimitRemaining: null, rateLimitReset: null, retryAfter: null };

  it('returns null for a 200, so the body is parsed next', () => {
    expect(classifyRepoResponse('user_repos', 200, none, true, clock)).toBeNull();
  });

  it.each<[RepoOperation, number, boolean, unknown]>([
    ['installation_repos', 404, true, { kind: 'unavailable', reason: 'unexpected' }],
    ['handle_repos', 403, false, { kind: 'unavailable', reason: 'forbidden' }],
    ['handle_repos', 401, false, { kind: 'unavailable', reason: 'unexpected' }],
  ])('maps %s %i (authenticated: %p)', (operation, status, authenticated, expected) => {
    expect(classifyRepoResponse(operation, status, none, authenticated, clock)).toEqual(expected);
  });
});

describe('hasNextLink', () => {
  it.each([
    [null, false],
    ['', false],
    ['<https://api.github.com/x?page=9>; rel="last"', false],
    ['<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=9>; rel="last"', true],
    ['<https://evil.example.com/x>; rel="next"', true],
  ])('reads %p as %p', (link, expected) => {
    expect(hasNextLink(link)).toBe(expected);
  });
});
