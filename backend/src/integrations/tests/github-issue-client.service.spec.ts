import { FakeClock } from '../../core/tests/support/fake-clock.js';
import { GithubIssueClientService } from '../github-issue-client.service.js';
import { Secret } from '../secret.js';
import { githubIssue, issue, issueGone, issueMoved, issuePage, issueRedirectOffHost, issueRenamed, jsonResponse, notFound, notModified, replyOnce, timeout } from './support/github-builders.js';
import { fetchCalls, fetchMock, installNoNetworkGuard } from './support/no-network-guard.js';

const TOKEN = new Secret('ghp_CANARYcanaryCLIENT000000000000000000a1');
const REPO = { githubId: 2 ** 31 + 55, owner: 'octo-org', name: 'widgets' };
const NUMBER = 8;

describe('GithubIssueClientService', () => {
  installNoNetworkGuard();

  const client = new GithubIssueClientService(new FakeClock(new Date('2026-01-01T00:00:00Z')));

  describe('getIssue', () => {
    it('sends GET with the pinned headers, the bearer token and no body', async () => {
      replyOnce(fetchMock(), issue(githubIssue()));
      await client.getIssue(TOKEN, REPO, NUMBER);

      const [call] = fetchCalls();

      expect(call.url).toBe('https://api.github.com/repos/octo-org/widgets/issues/8');
      expect(call.init).toMatchObject({ method: 'GET', redirect: 'manual' });
      expect(call.init.body).toBeUndefined();
      expect(call.headers.Authorization).toBe(`Bearer ${TOKEN.reveal()}`);
      expect(call.headers['If-None-Match']).toBeUndefined();
    });

    it('sends If-None-Match with an etag and answers not_modified for a 304', async () => {
      replyOnce(fetchMock(), notModified());

      const { result, status } = await client.getIssue(TOKEN, REPO, NUMBER, 'W/"old"');

      expect(fetchCalls()[0].headers['If-None-Match']).toBe('W/"old"');
      expect(result).toEqual({ kind: 'not_modified' });
      expect(status).toBe(304);
    });

    it('answers ok with the etag from the ETag header, or null', async () => {
      const value = githubIssue();

      replyOnce(fetchMock(), issue(value, { etag: 'W/"x"' }));
      replyOnce(fetchMock(), issue(value, { etag: null }));

      expect((await client.getIssue(TOKEN, REPO, NUMBER)).result).toEqual({ kind: 'ok', issue: value, etag: 'W/"x"' });
      expect((await client.getIssue(TOKEN, REPO, NUMBER)).result).toEqual({ kind: 'ok', issue: value, etag: null });
    });

    it('URL-encodes owner and name', async () => {
      replyOnce(fetchMock(), issue(githubIssue()));
      await client.getIssue(TOKEN, { ...REPO, owner: 'o w', name: 'a/b?c#d' }, NUMBER);

      expect(fetchCalls()[0].url).toBe('https://api.github.com/repos/o%20w/a%2Fb%3Fc%23d/issues/8');
    });

    it.each([
      ['a zero number', { repo: REPO, number: 0 }],
      ['a fractional number', { repo: REPO, number: 1.5 }],
      ['a negative number', { repo: REPO, number: -1 }],
      ['an unsafe number', { repo: REPO, number: 2 ** 53 }],
      ['a zero githubId', { repo: { ...REPO, githubId: 0 }, number: 1 }],
      ['a dot-dot owner', { repo: { ...REPO, owner: '..' }, number: 1 }],
      ['an empty name', { repo: { ...REPO, name: '' }, number: 1 }],
    ])('rejects %s before any call', async (_name, { repo, number }) => {
      await expect(client.getIssue(TOKEN, repo, number)).rejects.toThrow(RangeError);
      expect(fetchCalls()).toHaveLength(0);
    });

    it.each([
      ['a 404', notFound(), { kind: 'not_found' }],
      ['a 410', issueGone(), { kind: 'gone' }],
      ['a transfer', issueMoved(), { kind: 'moved' }],
    ])('answers %s', async (_name, githubCase, expected) => {
      replyOnce(fetchMock(), githubCase);

      expect((await client.getIssue(TOKEN, REPO, NUMBER)).result).toEqual(expected);
    });

    it('answers unexpected for a malformed or over-cap 200', async () => {
      fetchMock().mockResolvedValueOnce(jsonResponse(200, { id: 1 }));
      fetchMock().mockResolvedValueOnce(new Response('x'.repeat(600 * 1024), { status: 200 }));
      fetchMock().mockResolvedValueOnce(new Response('not json', { status: 200 }));

      for (let index = 0; index < 3; index += 1) {
        expect((await client.getIssue(TOKEN, REPO, NUMBER)).result).toEqual({ kind: 'unavailable', reason: 'unexpected' });
      }
    });

    it('answers a timeout and a network error as unavailable, with no status', async () => {
      replyOnce(fetchMock(), timeout());
      fetchMock().mockRejectedValueOnce(new TypeError('fetch failed'));

      expect(await client.getIssue(TOKEN, REPO, NUMBER)).toEqual({ result: { kind: 'unavailable', reason: 'timeout' }, rateLimit: null, status: null });
      expect(await client.getIssue(TOKEN, REPO, NUMBER)).toEqual({ result: { kind: 'unavailable', reason: 'network_error' }, rateLimit: null, status: null });
    });

    it('follows a rename once and answers renamedTo from the followed answer', async () => {
      const value = githubIssue();

      replyOnce(fetchMock(), issueRenamed(REPO, NUMBER, value, { owner: 'new-org', name: 'gadgets' }));

      const { result } = await client.getIssue(TOKEN, REPO, NUMBER, 'W/"old"');

      expect(result).toMatchObject({ kind: 'ok', issue: value, renamedTo: { owner: 'new-org', name: 'gadgets' } });
      expect(fetchCalls().map(({ url }) => url)).toEqual([
        'https://api.github.com/repos/octo-org/widgets/issues/8',
        `https://api.github.com/repositories/${REPO.githubId}/issues/8`,
      ]);
      expect(fetchCalls()[1].headers['If-None-Match']).toBe('W/"old"');
      expect(fetchCalls()[1].headers.Authorization).toBe(`Bearer ${TOKEN.reveal()}`);
    });

    it('answers unexpected when the followed answer has no usable repository_url', async () => {
      const raw = { id: 5, number: NUMBER, title: 't', body: null, state: 'open', updated_at: '2026-01-01T00:00:00Z', repository_url: 'https://evil.example/repos/o/n' };

      fetchMock().mockResolvedValueOnce(new Response(null, {
        status: 301,
        headers: { location: `https://api.github.com/repositories/${REPO.githubId}/issues/${NUMBER}` },
      }));
      fetchMock().mockResolvedValueOnce(jsonResponse(200, raw));

      expect((await client.getIssue(TOKEN, REPO, NUMBER)).result).toEqual({ kind: 'unavailable', reason: 'unexpected' });
    });

    it('answers a followed 404 as not_found, without renamedTo', async () => {
      fetchMock().mockResolvedValueOnce(new Response(null, {
        status: 301,
        headers: { location: `https://api.github.com/repositories/${REPO.githubId}/issues/${NUMBER}` },
      }));
      replyOnce(fetchMock(), notFound());

      expect((await client.getIssue(TOKEN, REPO, NUMBER)).result).toEqual({ kind: 'not_found' });
    });

    it('answers unavailable (redirect) for a second 301, and sends no third request', async () => {
      const location = `https://api.github.com/repositories/${REPO.githubId}/issues/${NUMBER}`;

      fetchMock().mockImplementation(async () => new Response(null, { status: 301, headers: { location } }));

      expect((await client.getIssue(TOKEN, REPO, NUMBER)).result).toEqual({ kind: 'unavailable', reason: 'redirect' });
      expect(fetchCalls()).toHaveLength(2);
    });

    it('sends no second request for an off-host Location', async () => {
      replyOnce(fetchMock(), issueRedirectOffHost());

      expect((await client.getIssue(TOKEN, REPO, NUMBER)).result).toEqual({ kind: 'unavailable', reason: 'redirect' });
      expect(fetchCalls()).toHaveLength(1);
    });
  });

  describe('probeIssues', () => {
    it('sends GET /issues?per_page=1 and answers ok for any array', async () => {
      replyOnce(fetchMock(), issuePage([githubIssue()]));

      expect((await client.probeIssues(TOKEN, REPO)).result).toEqual({ kind: 'ok' });
      expect(fetchCalls().map(({ url, init }) => [init.method, url])).toEqual([['GET', 'https://api.github.com/repos/octo-org/widgets/issues?per_page=1']]);
    });

    it('answers unexpected for a 200 that is not an array', async () => {
      fetchMock().mockResolvedValueOnce(jsonResponse(200, { message: 'hi' }));

      expect((await client.probeIssues(TOKEN, REPO)).result).toEqual({ kind: 'unavailable', reason: 'unexpected' });
    });

    it('never follows a redirect: a 301 is unavailable (redirect), even a rename-shaped one', async () => {
      fetchMock().mockResolvedValueOnce(new Response(null, {
        status: 301,
        headers: { location: `https://api.github.com/repositories/${REPO.githubId}/issues` },
      }));

      expect((await client.probeIssues(TOKEN, REPO)).result).toEqual({ kind: 'unavailable', reason: 'redirect' });
      expect(fetchCalls()).toHaveLength(1);
    });
  });

  describe('updateIssue', () => {
    it('sends PATCH with Content-Type and exactly the given diff', async () => {
      const value = githubIssue({ state: 'closed' });

      replyOnce(fetchMock(), issue(value));

      const { result } = await client.updateIssue(TOKEN, REPO, NUMBER, { title: 'T', body: null, state: 'closed' });
      const [call] = fetchCalls();

      expect(call.init.method).toBe('PATCH');
      expect(call.init.redirect).toBe('manual');
      expect(call.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(call.init.body as string)).toEqual({ title: 'T', body: null, state: 'closed' });
      expect(Object.keys(JSON.parse(call.init.body as string)).sort()).toEqual(['body', 'state', 'title']);
      expect(result).toEqual({ kind: 'ok', issue: value });
    });

    it('sends only the fields it was given', async () => {
      replyOnce(fetchMock(), issue(githubIssue()));
      await client.updateIssue(TOKEN, REPO, NUMBER, { state: 'open', title: undefined });

      expect(fetchCalls()[0].init.body).toBe('{"state":"open"}');
    });

    it('never sends state_reason, and never spreads its input', async () => {
      const changes = { title: 'T' } as Record<string, unknown>;

      Object.defineProperty(changes, 'inherited', { value: 'x', enumerable: false });
      replyOnce(fetchMock(), issue(githubIssue()));
      await client.updateIssue(TOKEN, REPO, NUMBER, changes);

      expect(fetchCalls()[0].init.body).toBe('{"title":"T"}');
    });

    it.each([
      ['state_reason', { state: 'closed', state_reason: 'completed' }],
      ['an unknown field', { title: 'T', assignees: ['x'] }],
      ['a labels field', { labels: [] }],
      ['an empty diff', {}],
      ['only undefined fields', { title: undefined }],
      ['a bad state', { state: 'merged' }],
      ['a non-string title', { title: 5 }],
      ['a non-string body', { body: 5 }],
    ])('throws before fetch for %s', async (_name, changes) => {
      await expect(client.updateIssue(TOKEN, REPO, NUMBER, changes as never)).rejects.toThrow(RangeError);
      expect(fetchCalls()).toHaveLength(0);
    });

    it('answers unavailable (unexpected) for a 422', async () => {
      fetchMock().mockResolvedValueOnce(jsonResponse(422, { message: 'Validation Failed CANARYcanaryBODY' }));

      expect((await client.updateIssue(TOKEN, REPO, NUMBER, { title: 'T' })).result).toEqual({ kind: 'unavailable', reason: 'unexpected' });
    });

    it('answers a 410 as gone and a 404 as not_found', async () => {
      replyOnce(fetchMock(), issueGone());
      replyOnce(fetchMock(), notFound());

      expect((await client.updateIssue(TOKEN, REPO, NUMBER, { title: 'T' })).result).toEqual({ kind: 'gone' });
      expect((await client.updateIssue(TOKEN, REPO, NUMBER, { title: 'T' })).result).toEqual({ kind: 'not_found' });
    });

    it('follows a rename once, resending the same method and body', async () => {
      const value = githubIssue();

      replyOnce(fetchMock(), issueRenamed(REPO, NUMBER, value, { owner: 'new-org', name: 'gadgets' }));

      const { result } = await client.updateIssue(TOKEN, REPO, NUMBER, { title: 'T' });
      const calls = fetchCalls();

      expect(result).toEqual({ kind: 'ok', issue: value, renamedTo: { owner: 'new-org', name: 'gadgets' } });
      expect(calls.map(({ init }) => [init.method, init.body])).toEqual([['PATCH', '{"title":"T"}'], ['PATCH', '{"title":"T"}']]);
      expect(calls[1].url).toBe(`https://api.github.com/repositories/${REPO.githubId}/issues/8`);
    });

    it('sends no second request for an off-host or transfer Location, and sends the credential only to api.github.com', async () => {
      replyOnce(fetchMock(), issueRedirectOffHost());
      replyOnce(fetchMock(), issueMoved());

      expect((await client.updateIssue(TOKEN, REPO, NUMBER, { title: 'T' })).result).toEqual({ kind: 'unavailable', reason: 'redirect' });
      expect((await client.updateIssue(TOKEN, REPO, NUMBER, { title: 'T' })).result).toEqual({ kind: 'moved' });
      expect(fetchCalls()).toHaveLength(2);
      expect(fetchCalls().every(({ url }) => new URL(url).origin === 'https://api.github.com')).toBe(true);
    });
  });

  it('never puts a token, URL or body in a result', async () => {
    replyOnce(fetchMock(), issue(githubIssue({ title: 'CANARYcanaryTITLE' })));

    const answer = await client.updateIssue(TOKEN, REPO, NUMBER, { title: 'T' });

    expect(JSON.stringify(answer.result)).not.toContain(TOKEN.reveal());
    expect(JSON.stringify(answer.result)).not.toContain('api.github.com');
  });
});
