import { ADD_WALK_MAX_CALLS, type AddWalkInput, walkAddCandidates } from '../add-candidate-walk.js';
import type { IntegrationRef, RepoResult } from '../github-repo-results.js';
import { FakeIntegrationsGithubService } from './support/fake-integrations-github.service.js';
import {
  forbidden,
  githubRepo,
  integrationUnusable,
  notFound,
  rateLimited,
  redirect,
  repository,
  serverError,
  timeout,
  unauthorized,
} from './support/github-builders.js';

const USER = 3;
const PUBLIC_REPO = githubRepo({ private: false });
const PRIVATE_REPO = githubRepo({ id: PUBLIC_REPO.githubId, private: true });
const GITHUB_ID = PUBLIC_REPO.githubId;

/**
 * A usable integration ref.
 * @param {number} id - The internal id.
 * @returns {IntegrationRef} The ref.
 */
function ref(id: number): IntegrationRef {
  return { id, uuid: `00000000-0000-4000-8000-00000000000${id}`, label: `i${id}`, type: 'pat' };
}

/**
 * The walk's input.
 * @param {Partial<AddWalkInput>} overrides - Overrides.
 * @returns {AddWalkInput} The input.
 */
function input(overrides: Partial<AddWalkInput> = {}): AddWalkInput {
  return {
    userId: USER,
    githubId: GITHUB_ID,
    holderIntegrationIds: [],
    handleSeesRepo: false,
    usable: [ref(1), ref(2), ref(3), ref(4)],
    ...overrides,
  };
}

describe('walkAddCandidates', () => {
  let fake: FakeIntegrationsGithubService;
  const walk = (walkInput: AddWalkInput): ReturnType<typeof walkAddCandidates> =>
    walkAddCandidates(walkInput, (userId, integrationId, githubId) => fake.getRepository(userId, integrationId, githubId));
  const calledIds = (): Array<number | null | undefined> => fake.githubCalls().map((call) => call.integrationId);

  beforeEach(() => {
    fake = new FakeIntegrationsGithubService();
  });

  it('walks usable holders oldest first and links the granting holder', async () => {
    fake.script(2, 'getRepository', GITHUB_ID, notFound());
    fake.script(3, 'getRepository', GITHUB_ID, repository(PUBLIC_REPO));

    expect(await walk(input({ holderIntegrationIds: [3, 2, 99] }))).toEqual({
      kind: 'ok',
      repo: PUBLIC_REPO,
      linkIntegrationId: 3,
    });
    expect(calledIds()).toEqual([2, 3]);
  });

  it.each([
    ['401', unauthorized()],
    ['403', forbidden()],
    ['404', notFound()],
  ])('moves on after a %s', async (_name, denial) => {
    fake.script(1, 'getRepository', GITHUB_ID, denial);
    fake.script(2, 'getRepository', GITHUB_ID, repository(PUBLIC_REPO));

    expect(await walk(input({ holderIntegrationIds: [1, 2] }))).toMatchObject({ kind: 'ok', linkIntegrationId: 2 });
  });

  it.each([
    ['a rate limit', rateLimited(new Date('2026-01-01T01:00:00Z')),
      { kind: 'rate_limited', resetAt: new Date('2026-01-01T01:00:00Z') }],
    ['a timeout', timeout(), { kind: 'unavailable', reason: 'timeout' }],
    ['a 5xx', serverError(), { kind: 'unavailable', reason: 'server_error' }],
    ['a redirect', redirect(), { kind: 'unavailable', reason: 'redirect' }],
  ])('stops on %s, with no fallback', async (_name, answer, expected) => {
    fake.script(1, 'getRepository', GITHUB_ID, answer);
    fake.script(2, 'getRepository', GITHUB_ID, repository(PUBLIC_REPO));

    expect(await walk(input({ holderIntegrationIds: [1, 2], handleSeesRepo: true }))).toEqual(expected);
    expect(calledIds()).toEqual([1]);
  });

  it(`never makes more than ${ADD_WALK_MAX_CALLS} GitHub calls, ending denied`, async () => {
    [1, 2, 3, 4].forEach((id) => fake.script(id, 'getRepository', GITHUB_ID, notFound()));
    fake.script(null, 'getRepository', GITHUB_ID, repository(PUBLIC_REPO));

    expect(await walk(input({ holderIntegrationIds: [1, 2, 3, 4], handleSeesRepo: true }))).toEqual({ kind: 'denied' });
    expect(calledIds()).toEqual([1, 2, 3]);
  });

  it('ends denied when every candidate denies', async () => {
    fake.script(1, 'getRepository', GITHUB_ID, unauthorized());
    fake.script(null, 'getRepository', GITHUB_ID, notFound());

    expect(await walk(input({ usable: [ref(1)], handleSeesRepo: true }))).toEqual({ kind: 'denied' });
    expect(calledIds()).toEqual([1, null]);
  });

  it('ends no_candidate before any GitHub call when no usable holder exists and the handle does not see it', async () => {
    expect(await walk(input({ holderIntegrationIds: [7, 8] }))).toEqual({ kind: 'no_candidate' });
    expect(fake.githubCalls()).toHaveLength(0);
  });

  it('moves past an integration that became unusable without counting a call', async () => {
    fake.script(1, 'getRepository', GITHUB_ID, integrationUnusable('missing'));
    fake.script(2, 'getRepository', GITHUB_ID, notFound());
    fake.script(3, 'getRepository', GITHUB_ID, notFound());
    fake.script(4, 'getRepository', GITHUB_ID, repository(PUBLIC_REPO));

    expect(await walk(input({ holderIntegrationIds: [1, 2, 3, 4] }))).toMatchObject({ kind: 'ok', linkIntegrationId: 4 });
  });

  describe('when only the public (handle) source sees the repo', () => {
    it('tries the usable integrations oldest first, then unauthenticated', async () => {
      fake.script(1, 'getRepository', GITHUB_ID, notFound());
      fake.script(2, 'getRepository', GITHUB_ID, unauthorized());
      fake.script(null, 'getRepository', GITHUB_ID, repository(PUBLIC_REPO));

      expect(await walk(input({ usable: [ref(1), ref(2)], handleSeesRepo: true }))).toEqual({
        kind: 'ok',
        repo: PUBLIC_REPO,
        linkIntegrationId: null,
      });
      expect(calledIds()).toEqual([1, 2, null]);
    });

    it('links none while the repo is still public', async () => {
      fake.script(1, 'getRepository', GITHUB_ID, repository(PUBLIC_REPO));

      expect(await walk(input({ usable: [ref(1)], handleSeesRepo: true })))
        .toEqual({ kind: 'ok', repo: PUBLIC_REPO, linkIntegrationId: null });
    });

    it('links the integration whose re-check found it private', async () => {
      fake.script(1, 'getRepository', GITHUB_ID, repository(PRIVATE_REPO));

      expect(await walk(input({ usable: [ref(1)], handleSeesRepo: true })))
        .toEqual({ kind: 'ok', repo: PRIVATE_REPO, linkIntegrationId: 1 });
    });

    it('never links the unauthenticated path', async () => {
      fake.script(null, 'getRepository', GITHUB_ID, { kind: 'ok', repo: PRIVATE_REPO } as RepoResult);

      expect(await walk(input({ usable: [], handleSeesRepo: true })))
        .toEqual({ kind: 'ok', repo: PRIVATE_REPO, linkIntegrationId: null });
    });

    it('tries holders before the other usable integrations', async () => {
      fake.script(3, 'getRepository', GITHUB_ID, notFound());
      fake.script(1, 'getRepository', GITHUB_ID, repository(PRIVATE_REPO));

      expect(await walk(input({ usable: [ref(1), ref(3)], holderIntegrationIds: [3], handleSeesRepo: true })))
        .toEqual({ kind: 'ok', repo: PRIVATE_REPO, linkIntegrationId: 1 });
      expect(calledIds()).toEqual([3, 1]);
    });
  });
});
