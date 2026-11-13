import { FakeClock } from '../../core/tests/support/fake-clock.js';
import { GithubUnauthenticatedBudget } from '../github-unauthenticated-budget.js';
import { jsonResponse, listingPage, repository, githubRepo } from './support/github-builders.js';
import { buildGithubServiceHarness, GithubServiceHarness, START } from './support/integrations-github-harness.js';
import { deferred, fetchCalls, fetchMock, installNoNetworkGuard } from './support/no-network-guard.js';

const RESET_SECONDS = Math.floor(START.getTime() / 1000) + 3600;
const RESET_AT = new Date(RESET_SECONDS * 1000);

/**
 * Rate-limit fields with a given remaining count.
 * @param {number} remaining - `X-RateLimit-Remaining`.
 * @param {number} [reset] - `X-RateLimit-Reset`, in epoch seconds.
 * @returns {{ rateLimitRemaining: number, rateLimitReset: number, retryAfter: null }} The fields.
 */
function fields(remaining: number, reset: number = RESET_SECONDS) {
  return { rateLimitRemaining: remaining, rateLimitReset: reset, retryAfter: null };
}

describe('GithubUnauthenticatedBudget', () => {
  let clock: FakeClock;
  let budget: GithubUnauthenticatedBudget;

  beforeEach(() => {
    clock = new FakeClock(START);
    budget = new GithubUnauthenticatedBudget(clock);
  });

  it('allows calls with no data yet', () => {
    expect(budget.tryAcquire('sync')).toEqual({ ok: true });
    expect(budget.tryAcquire('add')).toEqual({ ok: true });
  });

  it.each([1, 5, 10])('with %i remaining refuses a sync acquire and grants an Add acquire', (remaining) => {
    budget.record(fields(remaining));

    expect(budget.tryAcquire('sync')).toEqual({ ok: false, resetAt: RESET_AT });
    expect(budget.tryAcquire('add')).toEqual({ ok: true });
  });

  it('with 11 remaining grants one sync acquire, then refuses (the grant is reserved)', () => {
    budget.record(fields(11));

    expect(budget.tryAcquire('sync')).toEqual({ ok: true });
    expect(budget.tryAcquire('sync')).toEqual({ ok: false, resetAt: RESET_AT });
  });

  it('at 0 refuses both', () => {
    budget.record(fields(0));

    expect(budget.tryAcquire('sync')).toEqual({ ok: false, resetAt: RESET_AT });
    expect(budget.tryAcquire('add')).toEqual({ ok: false, resetAt: RESET_AT });
  });

  it('reserves in-flight calls, so concurrent acquires never overshoot', () => {
    budget.record(fields(3));

    const grants = Array.from({ length: 10 }, () => budget.tryAcquire('add')).filter((grant) => grant.ok);

    expect(grants).toHaveLength(3);
  });

  it('keeps the minimum Remaining within a window: a late, higher one does not raise it', () => {
    budget.record(fields(11));
    budget.record(fields(30));

    expect(budget.tryAcquire('sync')).toEqual({ ok: true });
    expect(budget.tryAcquire('sync')).toEqual({ ok: false, resetAt: RESET_AT });
  });

  it('ignores a response from an older window', () => {
    budget.record(fields(0));
    budget.record(fields(50, RESET_SECONDS - 3600));

    expect(budget.tryAcquire('add')).toEqual({ ok: false, resetAt: RESET_AT });
  });

  it('starts a new window on a later Reset', () => {
    budget.record(fields(0));
    budget.record(fields(60, RESET_SECONDS + 3600));

    expect(budget.tryAcquire('sync')).toEqual({ ok: true });
  });

  it('allows calls once the reset passed on the FakeClock, until the next response', () => {
    budget.record(fields(0));
    clock.set(RESET_AT);

    expect(budget.tryAcquire('sync')).toEqual({ ok: true });
    expect(budget.tryAcquire('sync')).toEqual({ ok: true });
  });

  it('ignores answers without rate-limit headers', () => {
    budget.record({ rateLimitRemaining: null, rateLimitReset: null, retryAfter: 30 });

    expect(budget.tryAcquire('sync')).toEqual({ ok: true });
  });
});

describe('IntegrationsGithubService unauthenticated budget', () => {
  installNoNetworkGuard();

  let harness: GithubServiceHarness;

  beforeEach(() => {
    harness = buildGithubServiceHarness();
  });

  it('answers rate_limited with the window resetAt and makes no fetch when refused', async () => {
    harness.budget.record(fields(10));

    expect(await harness.service.listHandleRepositories(1, null, 'octocat', 1))
      .toEqual({ kind: 'rate_limited', resetAt: RESET_AT });
    expect(fetchCalls()).toHaveLength(0);
  });

  it('is shared by the sync and Add: a low budget recorded by Add stops the sync', async () => {
    fetchMock().mockResolvedValueOnce(jsonResponse(200, { id: 5, name: 'r', private: false, owner: { login: 'o' } }, {
      'x-ratelimit-remaining': '4',
      'x-ratelimit-reset': String(RESET_SECONDS),
    }));

    await harness.service.getRepository(1, null, 5);

    expect(await harness.service.listHandleRepositories(1, null, 'octocat', 1))
      .toEqual({ kind: 'rate_limited', resetAt: RESET_AT });
    expect(fetchCalls()).toHaveLength(1);
  });

  it('records a 304 too', async () => {
    fetchMock().mockResolvedValueOnce(new Response(null, {
      status: 304,
      headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(RESET_SECONDS) },
    }));

    await harness.service.listHandleRepositories(1, null, 'octocat', 1, 'W/"x"');

    expect(await harness.service.getRepository(1, null, 5)).toEqual({ kind: 'rate_limited', resetAt: RESET_AT });
  });

  it('does not consult the budget for authenticated calls', async () => {
    const row = await harness.seed();
    const repo = githubRepo();

    harness.budget.record(fields(0));
    fetchMock().mockImplementationOnce(async () => (repository(repo).raw as () => Response)());

    expect(await harness.service.getRepository(1, row.id, repo.githubId)).toEqual({ kind: 'ok', repo });
  });

  it('never overshoots with concurrent calls (deferred fetch replies)', async () => {
    harness.budget.record(fields(12));
    const replies = [deferred<Response>(), deferred<Response>(), deferred<Response>()];

    replies.forEach((reply) => fetchMock().mockImplementationOnce(() => reply.promise));

    const calls = [1, 2, 3].map((page) => harness.service.listHandleRepositories(1, null, 'octocat', page));

    replies.forEach((reply) => reply.resolve((listingPage(1, []).raw as () => Response)()));

    const results = await Promise.all(calls);

    expect(fetchCalls()).toHaveLength(2);
    expect(results.map((result) => result.kind)).toEqual(['ok', 'ok', 'rate_limited']);
  });
});
