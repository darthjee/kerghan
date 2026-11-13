import { ConfigService } from '@nestjs/config';
import { FakeClock } from '../../core/tests/support/fake-clock.js';
import type { IntegrationRef } from '../../integrations/integrations-github.public.js';
import type { IntegrationsGithubService } from '../../integrations/integrations-github.public.js';
import {
  forbidden,
  notFound,
  rateLimited,
  redirect,
  repository,
  serverError,
  timeout,
} from '../../integrations/tests/support/github-builders.js';
import { FakeIntegrationsGithubService } from '../../integrations/tests/support/fake-integrations-github.service.js';
import { RepositoriesConfig } from '../repositories-config.js';
import type { RepositoriesService } from '../repositories.service.js';
import { RepositoryAddRateLimiter } from '../repository-add-rate-limiter.js';
import { RepositoryAddService } from '../repository-add.service.js';
import { FakeRepositoriesService } from './support/fake-repositories.service.js';

const OWNER = 1;
const INTRUDER = 2;
const GITHUB_ID = 4_000_000_001;
const WORK: IntegrationRef = { id: 11, uuid: 'uuid-work', label: 'work-pat', type: 'pat' };
const START = new Date('2026-11-07T12:00:00Z');

interface Built {
  service: RepositoryAddService;
  repositories: FakeRepositoriesService;
  github: FakeIntegrationsGithubService;
  clock: FakeClock;
}

function build(env: Record<string, unknown> = {}): Built {
  const clock = new FakeClock(START);
  const repositories = new FakeRepositoriesService().setNow(() => clock.now());
  const github = new FakeIntegrationsGithubService();
  const config = new RepositoriesConfig({ get: (key: string) => env[key] } as unknown as ConfigService);
  const service = new RepositoryAddService(
    repositories as unknown as RepositoriesService,
    github as unknown as IntegrationsGithubService,
    new RepositoryAddRateLimiter(clock, config),
    clock,
  );

  return { service, repositories, github, clock };
}

async function failure(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
  try {
    await promise;
  } catch (error) {
    const http = error as { getStatus(): number; getResponse(): unknown };

    return { status: http.getStatus(), body: http.getResponse() };
  }

  throw new Error('expected a rejection');
}

describe('RepositoryAddService', () => {
  let ctx: Built;

  beforeEach(() => {
    ctx = build();
    ctx.github.setUsable(OWNER, [WORK]);
  });

  describe('lookup', () => {
    it('answers 404 with no GitHub call and no write for a ref not among the caller rows', async () => {
      ctx.repositories.seed(INTRUDER, { githubId: GITHUB_ID, holderIntegrationIds: [WORK.id] });

      expect(await failure(ctx.service.add(OWNER, { githubId: GITHUB_ID }))).toEqual({
        status: 404,
        body: { statusCode: 404, message: 'Repository not found', error: 'Not Found' },
      });
      expect(ctx.github.githubCalls()).toEqual([]);
      expect(ctx.repositories.callsOf('markAdded')).toEqual([]);
    });

    it('answers the already-added row unchanged, with no GitHub call and no write', async () => {
      const addedAt = new Date('2026-10-01T00:00:00Z');
      ctx.repositories.seed(OWNER, { githubId: GITHUB_ID, addedAt, holderIntegrationIds: [WORK.id] });

      const row = await ctx.service.add(OWNER, { githubId: GITHUB_ID });

      expect(row).toMatchObject({ githubId: GITHUB_ID, status: 'added', addedAt });
      expect(ctx.github.githubCalls()).toEqual([]);
      expect(ctx.repositories.callsOf('markAdded')).toEqual([]);
    });

    it('runs the handle reconciliation before the lookup', async () => {
      ctx.repositories.seed(OWNER, { githubId: GITHUB_ID, addedAt: START });

      await ctx.service.add(OWNER, { githubId: GITHUB_ID });

      expect(ctx.repositories.calls.map((call) => call.method)).toEqual(['reconcileForRequest', 'findByRef']);
    });

    it('answers 401 when the session user no longer exists, before the lookup', async () => {
      ctx.repositories.markNoUser(OWNER);

      expect((await failure(ctx.service.add(OWNER, { githubId: GITHUB_ID }))).status).toBe(401);
      expect(ctx.repositories.callsOf('findByRef')).toEqual([]);
    });
  });

  describe('rate limit', () => {
    it('counts before the lookup, so 404 attempts count too', async () => {
      for (let i = 0; i < 30; i += 1) {
        expect((await failure(ctx.service.add(OWNER, { githubId: GITHUB_ID }))).status).toBe(404);
      }

      const refused = await failure(ctx.service.add(OWNER, { githubId: GITHUB_ID }));

      expect(refused).toEqual({
        status: 429,
        body: {
          code: 'REPOSITORY_ADD_RATE_LIMITED',
          message: 'Too many repositories added; try again later',
          retryAfterSeconds: 60,
        },
      });
      expect(ctx.repositories.callsOf('findByRef')).toHaveLength(30);
      expect(ctx.repositories.callsOf('reconcileForRequest')).toHaveLength(30);
    });

    it('rounds the delay up to whole seconds', async () => {
      ctx = build({ KERGHAN_REPOSITORIES_ADD_MAX_PER_WINDOW: '1' });
      await failure(ctx.service.add(OWNER, { githubId: GITHUB_ID }));
      ctx.clock.advance(500);

      expect((await failure(ctx.service.add(OWNER, { githubId: GITHUB_ID }))).body)
        .toMatchObject({ retryAfterSeconds: 60 });
    });
  });

  describe('re-check', () => {
    beforeEach(() => {
      ctx.repositories.seed(OWNER, {
        githubId: GITHUB_ID,
        owner: 'Darthjee',
        name: 'kerghan',
        holderIntegrationIds: [WORK.id],
      });
    });

    it('builds the re-check from the stored githubId when the ref is a differently-cased fullName', async () => {
      ctx.github.script(WORK.id, 'getRepository', '*', repository({ githubId: GITHUB_ID, owner: 'darthjee', name: 'kerghan', private: false }));

      const row = await ctx.service.add(OWNER, { fullName: 'DARTHJEE/KERGHAN' });

      expect(ctx.github.githubCalls()).toEqual([
        { operation: 'getRepository', userId: OWNER, integrationId: WORK.id, page: GITHUB_ID },
      ]);
      expect(ctx.repositories.callsOf('markAdded')[0].args).toEqual([
        { githubId: GITHUB_ID },
        WORK.id,
        { owner: 'darthjee', name: 'kerghan', private: false },
      ]);
      expect(row).toMatchObject({ githubId: GITHUB_ID, status: 'added', addedAt: START, fullName: 'darthjee/kerghan' });
    });

    it('answers 409 REPOSITORY_SOURCE_UNUSABLE with no GitHub call and no write when no candidate is left', async () => {
      ctx.github.setUsable(OWNER, []);

      expect(await failure(ctx.service.add(OWNER, { githubId: GITHUB_ID }))).toEqual({
        status: 409,
        body: {
          code: 'REPOSITORY_SOURCE_UNUSABLE',
          message: 'The integration that sees this repository needs attention.',
        },
      });
      expect(ctx.github.githubCalls()).toEqual([]);
      expect(ctx.repositories.callsOf('markAdded')).toEqual([]);
    });

    it.each([
      ['not found', notFound()],
      ['forbidden', forbidden()],
    ])('answers 404 when every candidate denies (%s), writing nothing', async (_label, answer) => {
      ctx.github.script(WORK.id, 'getRepository', '*', answer);

      const denied = await failure(ctx.service.add(OWNER, { githubId: GITHUB_ID }));
      const missing = await failure(ctx.service.add(OWNER, { githubId: 1 }));

      expect(denied).toEqual(missing);
      expect(denied.status).toBe(404);
      expect(ctx.repositories.callsOf('markAdded')).toEqual([]);
    });

    it('answers 503 GITHUB_RATE_LIMITED with the delay until the reset, rounded up', async () => {
      ctx.github.script(WORK.id, 'getRepository', '*', rateLimited(new Date(START.getTime() + 90_000)));

      expect(await failure(ctx.service.add(OWNER, { githubId: GITHUB_ID }))).toEqual({
        status: 503,
        body: { code: 'GITHUB_RATE_LIMITED', message: 'GitHub rate limit reached; try again later', retryAfterSeconds: 90 },
      });
      expect(ctx.repositories.callsOf('markAdded')).toEqual([]);
    });

    it('answers 503 with no delay when the reset is unknown, and never a negative one', async () => {
      ctx.github.script(WORK.id, 'getRepository', '*', { kind: 'rate_limited', resetAt: null }, rateLimited(new Date(START.getTime() - 5_000)));

      expect(await failure(ctx.service.add(OWNER, { githubId: GITHUB_ID }))).toEqual({
        status: 503,
        body: { code: 'GITHUB_RATE_LIMITED', message: 'GitHub rate limit reached; try again later' },
      });
      expect((await failure(ctx.service.add(OWNER, { githubId: GITHUB_ID }))).body).toMatchObject({ retryAfterSeconds: 0 });
    });

    it.each([
      ['timeout', timeout()],
      ['5xx', serverError()],
      ['redirect', redirect()],
    ])('answers 502 GITHUB_UNAVAILABLE on a %s', async (_label, answer) => {
      ctx.github.script(WORK.id, 'getRepository', '*', answer);

      expect(await failure(ctx.service.add(OWNER, { githubId: GITHUB_ID }))).toEqual({
        status: 502,
        body: { code: 'GITHUB_UNAVAILABLE', message: 'GitHub is unavailable; try again later' },
      });
      expect(ctx.repositories.callsOf('markAdded')).toEqual([]);
    });
  });

  describe('write', () => {
    beforeEach(() => {
      ctx.repositories.seed(OWNER, { githubId: GITHUB_ID, holderIntegrationIds: [WORK.id] });
      ctx.github.script(WORK.id, 'getRepository', '*', repository({ githubId: GITHUB_ID, owner: 'octo', name: 'x', private: true }));
    });

    it('answers 404 when the row was pruned meanwhile (gone)', async () => {
      ctx.repositories.pruneOnMark();

      const gone = await failure(ctx.service.add(OWNER, { githubId: GITHUB_ID }));

      expect(gone).toEqual(await failure(ctx.service.add(OWNER, { githubId: 1 })));
      expect(gone.status).toBe(404);
    });

    it('answers the stored row when a concurrent Add won (already_added)', async () => {
      const winner = new Date('2026-11-07T11:00:00Z');
      const markAdded = ctx.repositories.markAdded.bind(ctx.repositories);
      jest.spyOn(ctx.repositories, 'markAdded').mockImplementation(async (...args) => {
        const outcome = await markAdded(...args);

        return outcome.kind === 'added'
          ? { kind: 'already_added', repository: { ...outcome.repository, addedAt: winner } }
          : outcome;
      });

      expect(await ctx.service.add(OWNER, { githubId: GITHUB_ID })).toMatchObject({ addedAt: winner });
    });
  });
});
