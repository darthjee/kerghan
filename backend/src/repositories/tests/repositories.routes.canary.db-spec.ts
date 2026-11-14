import { randomBytes } from 'node:crypto';
import type request from 'supertest';
import { seedRepo } from './support/repo-rows.js';
import {
  buildRepositoriesHttpDbHarness,
  HARNESS_START,
  post,
  type RepositoriesHttpDbHarness,
} from './support/repositories-http-db-harness.js';
import { ref } from './support/sync-harness.js';
import { seedIntegration, seedTwoUserBaseline } from './support/two-user-baseline.js';
import type { IntegrationRef, RepoPageResult, RepoResult } from '../../integrations/integrations-github.public.js';
import { githubRepo, listingPage, repository } from '../../integrations/tests/support/github-builders.js';

// The credential canary sweep (`security.md#required-tests`): every place the
// fakes and the database can carry credential material or a GitHub error is
// seeded with a recognisable canary; no response body, header or log line of
// any route may ever contain one.
const FRAGMENT = 'CANARYcanary';
const CANARY_PAT = `ghp_${FRAGMENT}PAT000000000000000000000001`;
const CANARY_OAUTH = `gho_${FRAGMENT}OAUTH00000000000000000000002`;
const CANARY_APP_KEY = `-----BEGIN RSA PRIVATE KEY-----${FRAGMENT}KEY-----END RSA PRIVATE KEY-----`;
const CANARY_INSTALLATION = `ghs_${FRAGMENT}INSTALL000000000000000000003`;
const CANARY_ERROR_BODY = `{"message":"${FRAGMENT} GitHub error body","documentation_url":"https://docs.github.com"}`;
const CANARY_ERROR_MESSAGE = `${FRAGMENT} GitHub error message`;
const SECRET_IV = randomBytes(12);

const OWNED_IDS = [5, 6, 7, 8, 9];
const UNUSABLE_ID = 77;
const ADD = { ok: 1001, denied: 1002, unavailable: 1003, rateLimited: 1004, unusable: 1005 };

const LEAK = {
  token: CANARY_PAT, accessToken: CANARY_OAUTH, privateKey: CANARY_APP_KEY,
  installationToken: CANARY_INSTALLATION, body: CANARY_ERROR_BODY, message: CANARY_ERROR_MESSAGE,
};

/** An integration ref that also carries every canary, as a leaky implementation would pass it on. */
function leakyRef(id: number): IntegrationRef {
  return { ...ref(id), ...LEAK } as IntegrationRef;
}

/** A typed result that also carries every canary. */
function leaky<T extends RepoPageResult | RepoResult>(result: T): T {
  return { ...result, ...LEAK } as T;
}

const ALLOWED_ERROR_MESSAGES = [
  'Repository not found',
  'The integration that sees this repository needs attention.',
  'Too many repositories added; try again later',
  'GitHub is unavailable; try again later',
  'GitHub rate limit reached; try again later',
];

describe('Repositories routes credential canary sweep (real MySQL)', () => {
  let harness: RepositoriesHttpDbHarness;
  let userId: number;
  let cookie: string;
  const responses: request.Response[] = [];

  /** Seeds the owner's integration rows with canaries in every credential column. */
  async function seedCanaryIntegrations(): Promise<void> {
    for (const type of ['pat', 'oauth_app', 'github_app'] as const) {
      const id = await seedIntegration(harness.ds, userId, { type });

      await harness.ds.query(
        'UPDATE integrations SET secret_iv = ?, secret_ciphertext = ?, github_login = ?, status_reason = ?, metadata = ? WHERE id = ?',
        [SECRET_IV, Buffer.from(`${CANARY_PAT}${CANARY_OAUTH}${CANARY_APP_KEY}`), CANARY_PAT, CANARY_ERROR_MESSAGE,
          JSON.stringify({ privateKey: CANARY_APP_KEY, installationToken: CANARY_INSTALLATION }), id],
      );
    }
  }

  /** Scripts a sync covering every source status, with canaries in every answer. */
  function scriptSync(): void {
    const refs = OWNED_IDS.map(leakyRef);
    const repos = Object.values(ADD).filter((id) => id !== ADD.unusable).map((id) => ({ ...githubRepo({ id, owner: 'octo', name: `r${id}` }), ...LEAK }));
    const answers: Record<number, RepoPageResult> = {
      5: leaky(listingPage(1, repos).resultFor('listRepositories') as RepoPageResult),
      6: leaky({ kind: 'unavailable', reason: 'server_error' }),
      7: leaky({ kind: 'invalid_credentials' }),
      8: leaky({ kind: 'rate_limited', resetAt: new Date(HARNESS_START.getTime() + 3_600_000) }),
      9: leaky(listingPage(1, [githubRepo({ id: 2001 })], { hasNext: true }).resultFor('listRepositories') as RepoPageResult),
    };

    harness.github.setUsable(userId, refs);
    OWNED_IDS.forEach((id) => {
      harness.github.script(id, 'listRepositories', '*', answers[id]);
      harness.github.script(id, 'listHandleRepositories', '*', leaky({ kind: 'not_found' }));
    });
    harness.github.script(null, 'listHandleRepositories', '*', leaky({ kind: 'not_found' }));
    harness.github
      .script(5, 'getRepository', ADD.ok, leaky(repository(githubRepo({ id: ADD.ok, owner: 'octo', name: `r${ADD.ok}` })).resultFor('getRepository') as RepoResult))
      .script(5, 'getRepository', ADD.denied, leaky({ kind: 'not_found' }))
      .script(5, 'getRepository', ADD.unavailable, leaky({ kind: 'unavailable', reason: 'server_error' }))
      .script(5, 'getRepository', ADD.rateLimited, leaky({ kind: 'rate_limited', resetAt: new Date(HARNESS_START.getTime() + 30_000) }));
  }

  async function record(pending: request.Test): Promise<request.Response> {
    const response = await pending;

    responses.push(response);
    return response;
  }

  beforeAll(async () => {
    harness = await buildRepositoriesHttpDbHarness({ KERGHAN_REPOSITORIES_SYNC_PAGE_CAP: '1', KERGHAN_REPOSITORIES_ADD_MAX_PER_WINDOW: '5' });
  });

  afterAll(async () => {
    await harness.close();
  });

  it('runs a sync with every source status, the listing, the sync state and every Add answer', async () => {
    ({ userId } = await seedTwoUserBaseline(harness.ds, { handle: 'darthjee' }));
    cookie = harness.sessionFor(userId);
    await seedCanaryIntegrations();
    scriptSync();

    expect((await record(post(harness, '/repositories/sync.json', cookie))).status).toBe(202);
    await harness.launcher.runAll();
    // Integration 7 is now non-usable, so its stored invalid_credentials is reported as such;
    // integration 77 (non-usable, never synced) is the only source of the repo Add answers 409 for.
    harness.github
      .setUsable(userId, OWNED_IDS.filter((id) => id !== 7).map(leakyRef))
      .setIntegrations(userId, [...OWNED_IDS, UNUSABLE_ID].map(leakyRef));
    await seedRepo(harness.ds, userId, { githubId: ADD.unusable, sources: [[`integration:${UNUSABLE_ID}`, 1]] });

    expect((await record(post(harness, '/repositories/mine.json', cookie))).status).toBe(200);
    const state = await record(post(harness, '/repositories/sync/state.json', cookie));

    expect(state.body.sources.map((source: { status: string }) => source.status).sort())
      .toEqual(['error', 'invalid_credentials', 'not_found', 'ok', 'page_cap_reached', 'pending', 'rate_limited']);

    const statuses = [];
    for (const githubId of [ADD.ok, ADD.denied, ADD.unusable, ADD.unavailable, ADD.rateLimited, ADD.denied]) {
      statuses.push((await record(post(harness, '/repositories/add.json', cookie, { githubId }))).status);
    }

    expect(statuses).toEqual([200, 404, 409, 502, 503, 429]);
  });

  it('leaks no canary in any response body or header', () => {
    const ivForms = [SECRET_IV.toString('hex'), SECRET_IV.toString('base64')];

    expect(responses.length).toBeGreaterThanOrEqual(9);
    responses.forEach((response) => {
      const text = `${JSON.stringify(response.body)}\n${JSON.stringify(response.headers)}`;

      expect(text).not.toContain(FRAGMENT);
      ivForms.forEach((form) => expect(text).not.toContain(form));
    });
  });

  it('echoes no GitHub error: every error message is one of the fixed ones', () => {
    responses
      .filter((response) => response.status >= 400)
      .forEach((response) => expect(ALLOWED_ERROR_MESSAGES).toContain(response.body.error.message));
  });

  it('leaks no canary in any log line', () => {
    const logged = harness.loggedText();

    expect(logged).not.toContain(FRAGMENT);
    expect(logged).not.toContain(SECRET_IV.toString('hex'));
  });
});
