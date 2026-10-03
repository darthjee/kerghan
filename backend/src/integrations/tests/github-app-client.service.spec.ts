import { inspect } from 'node:util';
import {
  GITHUB_INSTALLATIONS_MAX_BODY_BYTES,
  GITHUB_USER_INSTALLATIONS_URL,
  GithubAppClientService,
} from '../github-app-client.service.js';
import { GithubClientError, GithubClientService } from '../github-client.service.js';
import { Secret } from '../secret.js';

const CANARY_USER = 'ghu_CANARYcanaryUSER000000000000000000';
const CANARY_JWT = 'eyCANARYcanaryJWT.payload.signature';
const CANARY_INSTALLATION_TOKEN = 'ghs_CANARYcanaryINSTALL0000000000000000';

/**
 * Builds a fetch `Response`.
 * @param {number} status - The HTTP status.
 * @param {unknown} body - The JSON body (or raw text).
 * @param {Record<string, string>} headers - The response headers.
 * @returns {Response} The response.
 */
function reply(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
}

/**
 * A raw `GET /user/installations` entry.
 * @param {number} id - The installation id.
 * @param {Record<string, unknown>} overrides - Fields to override.
 * @returns {Record<string, unknown>} The entry.
 */
function rawInstallation(id: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    app_id: 123456,
    account: { login: 'acme', type: 'Organization', id: 99 },
    repository_selection: 'selected',
    permissions: { issues: 'read', metadata: 'read', contents: 'read' },
    suspended_at: null,
    ...overrides,
  };
}

describe('GithubAppClientService', () => {
  let service: GithubAppClientService;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    service = new GithubAppClientService();
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listUserInstallations', () => {
    it('GETs the first page with the user token, refusing redirects', async () => {
      fetchMock.mockResolvedValue(reply(200, { total_count: 0, installations: [] }));

      await service.listUserInstallations(new Secret(CANARY_USER));

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.github.com/user/installations?per_page=100');
      expect(url).toBe(GITHUB_USER_INSTALLATIONS_URL);
      expect(init.method).toBe('GET');
      expect(init.redirect).toBe('error');
      expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${CANARY_USER}`);
    });

    it('parses the entries, dropping malformed ones', async () => {
      fetchMock.mockResolvedValue(reply(200, {
        installations: [
          rawInstallation(1),
          rawInstallation(2, { account: { login: 'octocat', type: 'User' }, app_id: 7 }),
          rawInstallation(3, { account: { login: 'bad login!', type: 'User' } }),
          rawInstallation(4, { account: { login: 'ent', type: 'Enterprise' } }),
          rawInstallation(0),
          rawInstallation(5, { app_id: '123456' }),
          'not an object',
        ],
      }));

      const page = await service.listUserInstallations(new Secret(CANARY_USER));

      expect(page.installations).toEqual([
        { installationId: 1, appId: 123456, accountLogin: 'acme', accountType: 'Organization' },
        { installationId: 2, appId: 7, accountLogin: 'octocat', accountType: 'User' },
      ]);
      expect(page.status).toBe(200);
    });

    it('follows a rel="next" link on the API host, and fetches it when asked', async () => {
      const next = 'https://api.github.com/user/installations?per_page=100&page=2';
      fetchMock.mockResolvedValueOnce(reply(200, { installations: [] }, {
        link: `<${next}>; rel="next", <https://api.github.com/user/installations?page=9>; rel="last"`,
      }));
      fetchMock.mockResolvedValueOnce(reply(200, { installations: [] }));

      const first = await service.listUserInstallations(new Secret(CANARY_USER));
      const second = await service.listUserInstallations(new Secret(CANARY_USER), first.nextUrl ?? undefined);

      expect(first.nextUrl).toBe(next);
      expect(fetchMock.mock.calls[1][0]).toBe(next);
      expect(second.nextUrl).toBeNull();
    });

    it('ignores a next link off the API host', async () => {
      fetchMock.mockResolvedValue(reply(200, { installations: [] }, { link: '<https://evil.example.com/x>; rel="next"' }));

      expect((await service.listUserInstallations(new Secret(CANARY_USER))).nextUrl).toBeNull();
    });

    it('accepts bodies beyond the generic 64 KiB cap, up to its own cap', async () => {
      const filler = 'x'.repeat(200 * 1024);
      fetchMock.mockResolvedValue(reply(200, { filler, installations: [rawInstallation(1)] }));

      expect((await service.listUserInstallations(new Secret(CANARY_USER))).installations).toHaveLength(1);
    });

    it('answers no installations for a body over its cap', async () => {
      const filler = 'x'.repeat(GITHUB_INSTALLATIONS_MAX_BODY_BYTES);
      fetchMock.mockResolvedValue(reply(200, { filler, installations: [] }));

      expect((await service.listUserInstallations(new Secret(CANARY_USER))).installations).toBeNull();
    });

    it('answers no installations nor next page on a non-200, with the rate-limit headers', async () => {
      fetchMock.mockResolvedValue(reply(403, { installations: [] }, {
        'x-ratelimit-remaining': '0',
        'retry-after': '30',
        link: '<https://api.github.com/user/installations?page=2>; rel="next"',
      }));

      const page = await service.listUserInstallations(new Secret(CANARY_USER));

      expect(page).toMatchObject({ status: 403, installations: null, nextUrl: null, rateLimitRemaining: 0, retryAfter: 30 });
    });

    it('answers no installations for a body without the array', async () => {
      fetchMock.mockResolvedValue(reply(200, { total_count: 1 }));

      expect((await service.listUserInstallations(new Secret(CANARY_USER))).installations).toBeNull();
    });

    it('rethrows a network error as a sanitized error', async () => {
      fetchMock.mockRejectedValue(new Error(`boom ${CANARY_USER}`));

      const error = await service.listUserInstallations(new Secret(CANARY_USER)).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(GithubClientError);
      expect(inspect(error, { depth: 10 })).not.toContain('CANARYcanary');
    });
  });

  describe('getAppInstallation', () => {
    it('GETs the installation with the app JWT', async () => {
      fetchMock.mockResolvedValue(reply(200, rawInstallation(42)));

      await service.getAppInstallation(new Secret(CANARY_JWT), 42);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.github.com/app/installations/42');
      expect(init.method).toBe('GET');
      expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${CANARY_JWT}`);
    });

    it('parses account, app id, selection, permissions and suspension', async () => {
      fetchMock.mockResolvedValue(reply(200, rawInstallation(42, { suspended_at: '2026-10-01T00:00:00Z' })));

      expect((await service.getAppInstallation(new Secret(CANARY_JWT), 42)).installation).toEqual({
        installationId: 42,
        appId: 123456,
        accountLogin: 'acme',
        accountType: 'Organization',
        repositorySelection: 'selected',
        permissions: { issues: 'read', metadata: 'read' },
        suspended: true,
      });
    });

    it('reports missing permissions as null', async () => {
      fetchMock.mockResolvedValue(reply(200, rawInstallation(42, { permissions: { issues: 'write' } })));

      expect((await service.getAppInstallation(new Secret(CANARY_JWT), 42)).installation)
        .toMatchObject({ permissions: { issues: 'write', metadata: null }, suspended: false });
    });

    it('treats an absent suspended_at as not suspended, and a missing permissions object as none', async () => {
      const raw = rawInstallation(42);
      delete raw.suspended_at;
      delete raw.permissions;
      fetchMock.mockResolvedValue(reply(200, raw));

      expect((await service.getAppInstallation(new Secret(CANARY_JWT), 42)).installation)
        .toMatchObject({ permissions: { issues: null, metadata: null }, suspended: false });
    });

    it.each([
      ['a bad repository selection', { repository_selection: 'some' }],
      ['a non-string suspended_at', { suspended_at: 5 }],
      ['no account', { account: null }],
      ['no app id', { app_id: undefined }],
    ])('answers no installation for %s', async (_label, overrides) => {
      fetchMock.mockResolvedValue(reply(200, rawInstallation(42, overrides)));

      expect((await service.getAppInstallation(new Secret(CANARY_JWT), 42)).installation).toBeNull();
    });

    it('answers no installation on a non-200', async () => {
      fetchMock.mockResolvedValue(reply(404, { message: 'Not Found' }));

      expect(await service.getAppInstallation(new Secret(CANARY_JWT), 42)).toMatchObject({ status: 404, installation: null });
    });
  });

  describe('createInstallationToken', () => {
    it('POSTs to access_tokens with the app JWT and never surfaces the token', async () => {
      fetchMock.mockResolvedValue(reply(201, { token: CANARY_INSTALLATION_TOKEN, expires_at: '2026-10-02T13:00:00Z' }));

      const result = await service.createInstallationToken(new Secret(CANARY_JWT), 42);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.github.com/app/installations/42/access_tokens');
      expect(init.method).toBe('POST');
      expect(result).toEqual({ status: 201, rateLimitRemaining: null, rateLimitReset: null, retryAfter: null });
      expect(JSON.stringify(result)).not.toContain('CANARYcanary');
    });
  });
});

describe('GithubClientService#exchangeOauthCode without a verifier', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends no code_verifier', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(reply(200, { access_token: 'ghu_x' }));

    await new GithubClientService().exchangeOauthCode({
      clientId: 'Iv23li',
      clientSecret: new Secret('secret'),
      code: new Secret('code'),
      redirectUri: 'https://kerghan.example.com/integrations/github_app/callback',
    });

    const params = new URLSearchParams((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(params.has('code_verifier')).toBe(false);
    expect(params.get('code')).toBe('code');
  });
});
