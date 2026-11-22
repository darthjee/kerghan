/**
 * The redirect and `Location` contract of the issue client
 * (`docs/agents/specs/issues/testing.md#fixtures`, E65).
 *
 * - **Recorded mode (always runs, in CI).** Replays the shapes of GitHub's
 *   `200`, `404`, `410` and `301` answers for `/repos/{owner}/{name}/issues/{number}`
 *   as typed raw responses (no recorded JSON files), including the rename
 *   `Location` form `https://api.github.com/repositories/{id}/issues/{n}`, and
 *   asserts the outcome of each, that a rename is followed once, that no other
 *   `Location` is followed, and that no call ever carries `Authorization` to a
 *   URL outside `https://api.github.com`.
 * - **Live mode (opt-in, skipped otherwise).** Runs the same cases against live
 *   GitHub, with the no-network guard not installed for its block. Enable it with
 *   `KERGHAN_GITHUB_CONTRACT_LIVE=1`, `KERGHAN_GITHUB_CONTRACT_TOKEN` (a token that
 *   can read the repository) and `KERGHAN_GITHUB_CONTRACT_REPO` (`owner/name`), plus
 *   `KERGHAN_GITHUB_CONTRACT_ISSUE` (an existing issue number). Optionally
 *   `KERGHAN_GITHUB_CONTRACT_DELETED_ISSUE` (a deleted issue, a `410`) and
 *   `KERGHAN_GITHUB_CONTRACT_TRANSFERRED_ISSUE` (an issue transferred away, whose
 *   `Location` is logged).
 *
 * The assumption: the `Location` GitHub answers for a transferred issue has not
 * been observed yet. "Any other `api.github.com` target means moved" holds only
 * until the live mode records one.
 */
import { GithubIssueClientService } from '../github-issue-client.service.js';
import type { GithubIssueRepo } from '../github-issue-results.js';
import { Secret } from '../secret.js';
import { githubIssue, jsonResponse, rawIssue } from './support/github-builders.js';
import { fetchCalls, fetchMock, installNoNetworkGuard } from './support/no-network-guard.js';
import { FakeClock } from '../../core/tests/support/fake-clock.js';

const REPO: GithubIssueRepo = { githubId: 2 ** 31 + 321, owner: 'octo-org', name: 'widgets' };
const NUMBER = 17;
const TOKEN = new Secret('ghp_CANARYcanaryREDIRECT0000000000000000f1');
const ORIGIN = 'https://api.github.com';
const RENAME_LOCATION = `${ORIGIN}/repositories/${REPO.githubId}/issues/${NUMBER}`;

/**
 * A recorded `301`.
 * @param {string | null} location - The `Location` (`null` for none).
 * @returns {Response} The response.
 */
function moved301(location: string | null): Response {
  return new Response(null, { status: 301, headers: location === null ? {} : { location } });
}

/**
 * Asserts no `fetch` call carried a credential to a URL outside `https://api.github.com`.
 * @returns {void}
 */
function expectNoCredentialOffGithub(): void {
  for (const call of fetchCalls()) {
    if (call.headers.Authorization !== undefined) {
      expect(new URL(call.url).origin).toBe(ORIGIN);
    }
  }
}

describe('issue redirect contract (recorded)', () => {
  installNoNetworkGuard();

  const client = new GithubIssueClientService(new FakeClock(new Date('2026-01-01T00:00:00Z')));

  describe('the recorded answers of GET /repos/{owner}/{name}/issues/{number}', () => {
    it('a 200 is the issue and its ETag', async () => {
      const issue = githubIssue({ number: NUMBER });

      fetchMock().mockResolvedValueOnce(jsonResponse(200, rawIssue(issue), { etag: 'W/"recorded"' }));

      expect((await client.getIssue(TOKEN, REPO, NUMBER)).result).toEqual({ kind: 'ok', issue, etag: 'W/"recorded"' });
    });

    it('a 404 is not_found', async () => {
      fetchMock().mockResolvedValueOnce(jsonResponse(404, { message: 'Not Found' }));

      expect((await client.getIssue(TOKEN, REPO, NUMBER)).result).toEqual({ kind: 'not_found' });
    });

    it('a 410 is gone', async () => {
      fetchMock().mockResolvedValueOnce(jsonResponse(410, { message: 'This issue was deleted' }));

      expect((await client.getIssue(TOKEN, REPO, NUMBER)).result).toEqual({ kind: 'gone' });
    });

    it('a 301 with the rename Location is followed once and carries renamedTo', async () => {
      const issue = githubIssue({ number: NUMBER });

      fetchMock()
        .mockResolvedValueOnce(moved301(RENAME_LOCATION))
        .mockResolvedValueOnce(jsonResponse(200, rawIssue(issue, { owner: 'renamed-org', name: 'gadgets' }), { etag: 'W/"r"' }));

      expect((await client.getIssue(TOKEN, REPO, NUMBER)).result)
        .toEqual({ kind: 'ok', issue, etag: 'W/"r"', renamedTo: { owner: 'renamed-org', name: 'gadgets' } });
      expect(fetchCalls().map(({ url }) => url)).toEqual([`${ORIGIN}/repos/octo-org/widgets/issues/${NUMBER}`, RENAME_LOCATION]);
      expectNoCredentialOffGithub();
    });

    it('a second 301 in one call is not followed', async () => {
      fetchMock().mockResolvedValueOnce(moved301(RENAME_LOCATION)).mockResolvedValueOnce(moved301(RENAME_LOCATION));

      expect((await client.getIssue(TOKEN, REPO, NUMBER)).result).toEqual({ kind: 'unavailable', reason: 'redirect' });
      expect(fetchCalls()).toHaveLength(2);
    });

    it('a rename whose followed answer has no usable repository_url is unavailable (unexpected)', async () => {
      const raw = rawIssue(githubIssue({ number: NUMBER }));

      delete raw.repository_url;
      fetchMock().mockResolvedValueOnce(moved301(RENAME_LOCATION)).mockResolvedValueOnce(jsonResponse(200, raw));

      expect((await client.getIssue(TOKEN, REPO, NUMBER)).result).toEqual({ kind: 'unavailable', reason: 'unexpected' });
    });
  });

  describe('a Location that is not a rename', () => {
    // The assumption of this spec's header: another api.github.com target means moved.
    it.each([
      ['another repository id', `${ORIGIN}/repositories/${REPO.githubId + 1}/issues/${NUMBER}`],
      ['another issue number', `${ORIGIN}/repositories/${REPO.githubId}/issues/${NUMBER + 1}`],
      ['another path shape', `${ORIGIN}/repos/new-org/widgets/issues/${NUMBER}`],
    ])('%s is moved and is not followed', async (_name, location) => {
      fetchMock().mockResolvedValueOnce(moved301(location));

      expect((await client.getIssue(TOKEN, REPO, NUMBER)).result).toEqual({ kind: 'moved' });
      expect(fetchCalls()).toHaveLength(1);
    });

    it.each([
      ['another host', `https://evil.example/repositories/${REPO.githubId}/issues/${NUMBER}`],
      ['another scheme', `http://api.github.com/repositories/${REPO.githubId}/issues/${NUMBER}`],
      ['another port', `https://api.github.com:8443/repositories/${REPO.githubId}/issues/${NUMBER}`],
      ['credentials in the URL', `https://user:pass@api.github.com/repositories/${REPO.githubId}/issues/${NUMBER}`],
      ['a host that only starts like GitHub', `https://api.github.com.evil.example/repositories/${REPO.githubId}/issues/${NUMBER}`],
      ['a userinfo trick', 'https://api.github.com@evil.example/x'],
      ['a query', `${RENAME_LOCATION}?x=1`],
      ['a fragment', `${RENAME_LOCATION}#x`],
      ['a malformed URL', 'not a url'],
      ['a relative URL', `/repositories/${REPO.githubId}/issues/${NUMBER}`],
      ['no Location', null],
    ])('%s is not followed and answers unavailable (redirect)', async (_name, location) => {
      fetchMock().mockResolvedValueOnce(moved301(location));

      expect((await client.getIssue(TOKEN, REPO, NUMBER)).result).toEqual({ kind: 'unavailable', reason: 'redirect' });
      expect(fetchCalls()).toHaveLength(1);
      expectNoCredentialOffGithub();
    });

    it.each([302, 307, 308])('a %i is classified like a 301', async (status) => {
      fetchMock().mockResolvedValueOnce(new Response(null, { status, headers: { location: 'https://evil.example/x' } }));

      expect((await client.getIssue(TOKEN, REPO, NUMBER)).result).toEqual({ kind: 'unavailable', reason: 'redirect' });
      expect(fetchCalls()).toHaveLength(1);
    });
  });

  it('never sends Authorization to a URL outside https://api.github.com, whatever the operation and Location', async () => {
    const locations = [RENAME_LOCATION, 'https://evil.example/x', 'http://api.github.com/x', 'https://api.github.com:8443/x'];

    for (const location of locations) {
      fetchMock().mockResolvedValue(moved301(location));
      await client.getIssue(TOKEN, REPO, NUMBER);
      await client.probeIssues(TOKEN, REPO);
      await client.updateIssue(TOKEN, REPO, NUMBER, { state: 'closed' });
    }

    expect(fetchCalls().length).toBeGreaterThan(0);
    expectNoCredentialOffGithub();
  });
});

const LIVE = process.env.KERGHAN_GITHUB_CONTRACT_LIVE === '1'
  && Boolean(process.env.KERGHAN_GITHUB_CONTRACT_TOKEN)
  && Boolean(process.env.KERGHAN_GITHUB_CONTRACT_REPO)
  && Boolean(process.env.KERGHAN_GITHUB_CONTRACT_ISSUE);
const liveDescribe = LIVE ? describe : describe.skip;

// No installNoNetworkGuard() here: this block talks to live GitHub.
liveDescribe('issue redirect contract (live, opt-in)', () => {
  const token = new Secret(process.env.KERGHAN_GITHUB_CONTRACT_TOKEN ?? '');
  const [owner, name] = (process.env.KERGHAN_GITHUB_CONTRACT_REPO ?? '/').split('/');
  const issueNumber = Number(process.env.KERGHAN_GITHUB_CONTRACT_ISSUE);
  const client = new GithubIssueClientService(new FakeClock(new Date()));
  let repo: GithubIssueRepo;

  beforeAll(async () => {
    const response = await fetch(`${ORIGIN}/repos/${owner}/${name}`, {
      headers: { Authorization: `Bearer ${token.reveal()}`, Accept: 'application/vnd.github+json', 'User-Agent': 'kerghan-contract' },
    });
    const body = await response.json() as { id: number };

    repo = { githubId: body.id, owner, name };
  });

  it('a live 200 has the recorded shape', async () => {
    const { result } = await client.getIssue(token, repo, issueNumber);

    expect(result).toMatchObject({ kind: 'ok', issue: { number: issueNumber } });
  });

  it('a live 404 is not_found', async () => {
    expect((await client.getIssue(token, repo, 2 ** 31 - 1)).result).toEqual({ kind: 'not_found' });
  });

  it('the live probe is ok', async () => {
    expect((await client.probeIssues(token, repo)).result).toEqual({ kind: 'ok' });
  });

  const deleted = process.env.KERGHAN_GITHUB_CONTRACT_DELETED_ISSUE;

  (deleted === undefined ? it.skip : it)('a live deleted issue is gone', async () => {
    expect((await client.getIssue(token, repo, Number(deleted))).result).toEqual({ kind: 'gone' });
  });

  const transferred = process.env.KERGHAN_GITHUB_CONTRACT_TRANSFERRED_ISSUE;

  (transferred === undefined ? it.skip : it)('logs the Location of a transferred issue, so the assumption can be recorded', async () => {
    const response = await fetch(`${ORIGIN}/repos/${owner}/${name}/issues/${transferred}`, {
      redirect: 'manual',
      headers: { Authorization: `Bearer ${token.reveal()}`, Accept: 'application/vnd.github+json', 'User-Agent': 'kerghan-contract' },
    });

    // eslint-disable-next-line no-console
    console.info(`transferred issue: status ${response.status}, Location ${response.headers.get('location')}`);
    expect([301, 302, 307, 308, 404, 410]).toContain(response.status);
  });
});
