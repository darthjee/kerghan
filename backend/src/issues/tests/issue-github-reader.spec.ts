import { FakeProjectRepositories } from './support/fake-project-repositories.js';
import { integrationRef } from './support/integration-refs.js';
import type { LoggerService } from '../../core/logger.service.js';
import { FakeClock } from '../../core/tests/support/fake-clock.js';
import type { IntegrationsGithubService } from '../../integrations/integrations-github.public.js';
import { FakeIntegrationsGithubService } from '../../integrations/tests/support/fake-integrations-github.service.js';
import {
  forbidden,
  githubIssue,
  githubPullRequest,
  integrationUnusable,
  issue,
  issueGone,
  issueMoved,
  issueRenamed,
  notFound,
  rateLimited,
  serverError,
  timeout,
  unauthorized,
} from '../../integrations/tests/support/github-builders.js';
import type { RepositoriesService } from '../../repositories/repositories.service.js';
import { IssueCandidates } from '../issue-candidates.js';
import { IssueGithubReader } from '../issue-github-reader.js';

const USER = 7;
const REPOSITORY = 1;
const NUMBER = 42;
const REPO = { githubId: 10, owner: 'octo', name: 'repo-10' };
const NOW = new Date('2026-11-07T12:00:00Z');

function build(sources: number[], usable = sources.map((id) => integrationRef(id))): {
  reader: IssueGithubReader;
  github: FakeIntegrationsGithubService;
  logger: { debug: jest.Mock };
} {
  const repositories = new FakeProjectRepositories().seed(USER, { repositoryId: REPOSITORY, githubId: 10, integrationSourceIds: sources });
  const github = new FakeIntegrationsGithubService().setUsable(USER, usable);
  const logger = { debug: jest.fn() };
  const candidates = new IssueCandidates(repositories as unknown as RepositoriesService, github as unknown as IntegrationsGithubService);

  return {
    github,
    logger,
    reader: new IssueGithubReader(
      candidates,
      github as unknown as IntegrationsGithubService,
      new FakeClock(NOW),
      logger as unknown as LoggerService,
    ),
  };
}

function read(reader: IssueGithubReader): ReturnType<IssueGithubReader['readForLink']> {
  return reader.readForLink(USER, REPOSITORY, REPO, NUMBER);
}

describe('IssueGithubReader', () => {
  describe('outcomes', () => {
    it('answers the issue, its ETag and the integration that read it', async () => {
      const { reader, github } = build([1]);
      const found = githubIssue({ number: NUMBER });

      github.script(1, 'getIssue', NUMBER, issue(found, { etag: 'W/"abc"' }));

      expect(await read(reader)).toEqual({ kind: 'ok', issue: found, etag: 'W/"abc"', integrationId: 1 });
    });

    it('answers a pull request as an issue and leaves the decision to the service', async () => {
      const { reader, github } = build([1]);
      const pull = githubPullRequest({ number: NUMBER });

      github.script(1, 'getIssue', NUMBER, issue(pull));

      expect(await read(reader)).toMatchObject({ kind: 'ok', issue: { isPullRequest: true } });
    });

    it('ignores a rename hint', async () => {
      const { reader, github } = build([1]);

      github.script(1, 'getIssue', NUMBER, issueRenamed(REPO, NUMBER, githubIssue({ number: NUMBER }), { owner: 'new', name: 'name' }));

      expect(await read(reader)).toMatchObject({ kind: 'ok', integrationId: 1 });
    });

    it.each([
      ['not_found', notFound()],
      ['gone', issueGone()],
      ['moved', issueMoved()],
    ])('maps %s to not_found', async (_label, answer) => {
      const { reader, github } = build([1]);

      github.script(1, 'getIssue', NUMBER, answer);

      expect(await read(reader)).toEqual({ kind: 'not_found' });
    });

    it.each([
      ['a timeout', timeout()],
      ['a 5xx', serverError()],
      ['an unclassifiable 301', { kind: 'unavailable', reason: 'redirect' } as const],
    ])('maps %s to unavailable', async (_label, answer) => {
      const { reader, github } = build([1]);

      github.script(1, 'getIssue', NUMBER, answer);

      expect(await read(reader)).toEqual({ kind: 'unavailable' });
    });

    it('treats not_modified as unavailable', async () => {
      const { reader, github } = build([1]);

      github.script(1, 'getIssue', NUMBER, { kind: 'not_modified' });

      expect(await read(reader)).toEqual({ kind: 'unavailable' });
    });

    it('computes the rate-limit delay from the reset, rounded up and at least one second', async () => {
      const { reader, github } = build([1]);

      github.script(1, 'getIssue', NUMBER, rateLimited(new Date(NOW.getTime() + 90_000)));
      expect(await read(reader)).toEqual({ kind: 'rate_limited', retryAfterSeconds: 90 });

      github.script(1, 'getIssue', NUMBER, rateLimited(new Date(NOW.getTime() - 5_000)));
      expect(await read(reader)).toEqual({ kind: 'rate_limited', retryAfterSeconds: 1 });
    });

    it('answers a null delay when the reset is unknown', async () => {
      const { reader, github } = build([1]);

      github.script(1, 'getIssue', NUMBER, { kind: 'rate_limited', resetAt: null });

      expect(await read(reader)).toEqual({ kind: 'rate_limited', retryAfterSeconds: null });
    });
  });

  describe('the walk', () => {
    it('falls back to the next candidate on a credential failure', async () => {
      const { reader, github } = build([1, 2, 3]);
      const found = githubIssue({ number: NUMBER });

      github.script(1, 'getIssue', NUMBER, unauthorized());
      github.script(2, 'getIssue', NUMBER, integrationUnusable('status'));
      github.script(3, 'getIssue', NUMBER, issue(found));

      expect(await read(reader)).toMatchObject({ kind: 'ok', integrationId: 3 });
      expect(github.githubCalls().map((call) => call.integrationId)).toEqual([1, 2, 3]);
    });

    it('falls back on a forbidden answer', async () => {
      const { reader, github } = build([1, 2]);

      github.script(1, 'getIssue', NUMBER, forbidden());
      github.script(2, 'getIssue', NUMBER, issue(githubIssue({ number: NUMBER })));

      expect(await read(reader)).toMatchObject({ kind: 'ok', integrationId: 2 });
    });

    it('tries the candidates in the order of the resolver', async () => {
      const { reader, github } = build([1, 2], [integrationRef(1, 'read_only'), integrationRef(2, 'writable')]);

      github.script(2, 'getIssue', NUMBER, issue(githubIssue({ number: NUMBER })));

      expect(await read(reader)).toMatchObject({ kind: 'ok', integrationId: 2 });
      expect(github.githubCalls()).toHaveLength(1);
    });

    it.each([
      ['a rate limit', rateLimited(new Date(NOW.getTime() + 1_000)), { kind: 'rate_limited', retryAfterSeconds: 1 }],
      ['a 5xx', serverError(), { kind: 'unavailable' }],
      ['a not_found', notFound(), { kind: 'not_found' }],
      ['a gone', issueGone(), { kind: 'not_found' }],
    ])('does not fall back on %s', async (_label, answer, outcome) => {
      const { reader, github } = build([1, 2]);

      github.script(1, 'getIssue', NUMBER, answer);
      github.script(2, 'getIssue', NUMBER, issue(githubIssue({ number: NUMBER })));

      expect(await read(reader)).toEqual(outcome);
      expect(github.githubCalls()).toHaveLength(1);
    });

    it('answers forbidden when any candidate answered forbidden and none could read', async () => {
      const { reader, github } = build([1, 2]);

      github.script(1, 'getIssue', NUMBER, unauthorized());
      github.script(2, 'getIssue', NUMBER, forbidden());

      expect(await read(reader)).toEqual({ kind: 'credential', reason: 'forbidden' });
    });

    it('answers credential_invalid when every candidate failed on its credential', async () => {
      const { reader, github } = build([1, 2]);

      github.script(1, 'getIssue', NUMBER, unauthorized());
      github.script(2, 'getIssue', NUMBER, integrationUnusable('missing'));

      expect(await read(reader)).toEqual({ kind: 'credential', reason: 'credential_invalid' });
    });

    it('never sends an ETag', async () => {
      const { reader, github } = build([1]);

      github.script(1, 'getIssue', NUMBER, issue(githubIssue({ number: NUMBER })));
      await read(reader);

      expect(github.githubCalls()[0]).toMatchObject({ etag: null, number: NUMBER, repo: REPO });
    });
  });

  describe('without a candidate', () => {
    it('answers no_credential and makes no GitHub call', async () => {
      const { reader, github } = build([]);

      expect(await read(reader)).toEqual({ kind: 'credential', reason: 'no_credential' });
      expect(github.githubCalls()).toEqual([]);
    });

    it('answers credential_invalid for a listing integration that is not usable', async () => {
      const { reader, github } = build([1], []);

      github.setIntegrations(USER, [integrationRef(1)]);

      expect(await read(reader)).toEqual({ kind: 'credential', reason: 'credential_invalid' });
      expect(github.githubCalls()).toEqual([]);
    });
  });

  it('logs the integration id and the outcome kind only', async () => {
    const { reader, github, logger } = build([1]);

    github.script(1, 'getIssue', NUMBER, issue(githubIssue({ number: NUMBER, title: 'SECRET TITLE' })));
    await read(reader);

    expect(logger.debug).toHaveBeenCalledWith('issue link read', { integrationId: 1, result: 'ok' });
    expect(JSON.stringify(logger.debug.mock.calls)).not.toContain('SECRET');
  });
});
