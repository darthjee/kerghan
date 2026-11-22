import { classifyIssueRedirect, isIssueRedirectStatus } from '../github-issue-redirect.js';

const REPO = { githubId: 2 ** 31 + 9, owner: 'octo-org', name: 'widgets' };
const NUMBER = 12;
const RENAME = `https://api.github.com/repositories/${REPO.githubId}/issues/${NUMBER}`;

describe('classifyIssueRedirect', () => {
  it('is a rename for the same repository id and number, with the URL rebuilt', () => {
    expect(classifyIssueRedirect(RENAME, REPO, NUMBER)).toEqual({ kind: 'renamed', url: RENAME });
  });

  it('rebuilds the URL, never copying it from the header', () => {
    const result = classifyIssueRedirect(RENAME, REPO, NUMBER);

    expect(result).toEqual({ kind: 'renamed', url: `https://api.github.com/repositories/${REPO.githubId}/issues/${NUMBER}` });
  });

  it.each([
    ['another repository id', `https://api.github.com/repositories/${REPO.githubId + 1}/issues/${NUMBER}`],
    ['another issue number', `https://api.github.com/repositories/${REPO.githubId}/issues/${NUMBER + 1}`],
    ['a zero-padded id', `https://api.github.com/repositories/0${REPO.githubId}/issues/${NUMBER}`],
    ['a zero-padded number', `https://api.github.com/repositories/${REPO.githubId}/issues/0${NUMBER}`],
    ['another path shape', `https://api.github.com/repos/octo-org/widgets/issues/${NUMBER}`],
    ['a longer path', `${RENAME}/comments`],
    ['a trailing slash', `${RENAME}/`],
    ['a percent-encoded digit', `https://api.github.com/repositories/${REPO.githubId}/issues/%31%32`],
    ['the repository only', `https://api.github.com/repositories/${REPO.githubId}`],
  ])('is moved for %s', (_name, location) => {
    expect(classifyIssueRedirect(location, REPO, NUMBER)).toEqual({ kind: 'moved' });
  });

  it.each([
    ['another host', `https://evil.example/repositories/${REPO.githubId}/issues/${NUMBER}`],
    ['a look-alike host', `https://api.github.com.evil.example/repositories/${REPO.githubId}/issues/${NUMBER}`],
    ['another scheme', `http://api.github.com/repositories/${REPO.githubId}/issues/${NUMBER}`],
    ['another port', `https://api.github.com:8443/repositories/${REPO.githubId}/issues/${NUMBER}`],
    ['the default port written out', `https://api.github.com:443/repositories/${REPO.githubId}/issues/${NUMBER}`],
    ['credentials', `https://user:pass@api.github.com/repositories/${REPO.githubId}/issues/${NUMBER}`],
    ['a username only', `https://user@api.github.com/repositories/${REPO.githubId}/issues/${NUMBER}`],
    ['a userinfo trick', 'https://api.github.com@evil.example/repositories/1/issues/1'],
    ['a query', `${RENAME}?x=1`],
    ['an empty query', `${RENAME}?`],
    ['a fragment', `${RENAME}#x`],
    ['an empty fragment', `${RENAME}#`],
    ['a relative Location', `/repositories/${REPO.githubId}/issues/${NUMBER}`],
    ['a scheme-relative Location', `//api.github.com/repositories/${REPO.githubId}/issues/${NUMBER}`],
    ['no path', 'https://api.github.com'],
    ['a malformed URL', 'not a url'],
    ['an empty Location', ''],
    ['a missing Location', null],
  ])('is unclassifiable for %s', (_name, location) => {
    expect(classifyIssueRedirect(location, REPO, NUMBER)).toEqual({ kind: 'unclassifiable' });
  });
});

describe('isIssueRedirectStatus', () => {
  it.each([301, 302, 307, 308])('%i is classified by Location', (status) => {
    expect(isIssueRedirectStatus(status)).toBe(true);
  });

  it.each([200, 300, 303, 304, 305, 404, 500])('%i is not', (status) => {
    expect(isIssueRedirectStatus(status)).toBe(false);
  });
});
