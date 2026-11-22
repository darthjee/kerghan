import type { DataSource, EntityManager } from 'typeorm';
import { FakeClock } from '../../core/tests/support/fake-clock.js';
import { FakeScheduler } from '../../core/tests/support/fake-scheduler.js';
import type { RepositoriesService } from '../../repositories/repositories.service.js';
import { IssueLinkPresenter, type LinkResponseInput, linkResponse, statesOf } from '../issue-link-presenter.js';
import { IssueRateLimitPauses } from '../issue-rate-limit-pauses.js';
import { IssueRateLimitWaits } from '../issue-rate-limit-waits.js';
import { IssuesConfig } from '../issues-config.js';
import { FakeProjectRepositories } from './support/fake-project-repositories.js';

const NOW = new Date('2026-11-17T12:00:00Z');
const ADDED = { owner: 'darthjee', name: 'kerghan', status: 'added' as const };

describe('statesOf', () => {
  const base = { status: 'linked', repositoryStatus: 'added', rateLimited: false, pending: false };

  it.each([
    ['gone', { status: 'gone' }, ['gone']],
    ['sync_failed', { status: 'sync_failed' }, ['sync_failed']],
    ['repository_unavailable', { repositoryStatus: 'unavailable' }, ['repository_unavailable']],
    ['a dangling repository', { repositoryStatus: null }, ['repository_unavailable']],
    ['rate_limited', { rateLimited: true }, ['rate_limited']],
    ['pending', { pending: true }, ['pending']],
    ['linked alone', {}, ['linked']],
  ])('reads %s alone', (_label, override, expected) => {
    expect(statesOf({ ...base, ...override })).toEqual(expected);
  });

  it.each([
    ['sync_failed plus pending', { status: 'sync_failed', pending: true }, ['sync_failed', 'pending']],
    ['gone plus a marker', { status: 'gone', pending: true }, ['gone', 'pending']],
    ['gone plus an unavailable repository', { status: 'gone', repositoryStatus: 'unavailable' }, ['gone', 'repository_unavailable']],
    [
      'every state',
      { status: 'sync_failed', repositoryStatus: 'unavailable', rateLimited: true, pending: true },
      ['sync_failed', 'repository_unavailable', 'rate_limited', 'pending'],
    ],
    ['rate_limited plus pending', { rateLimited: true, pending: true }, ['rate_limited', 'pending']],
    ['unavailable plus rate_limited', { repositoryStatus: 'unavailable', rateLimited: true }, ['repository_unavailable', 'rate_limited']],
  ])('lists %s in precedence order', (_label, override, expected) => {
    expect(statesOf({ ...base, ...override })).toEqual(expected);
  });

  it('never lists linked next to another state', () => {
    expect(statesOf({ ...base, pending: true })).not.toContain('linked');
  });
});

describe('linkResponse', () => {
  const input: LinkResponseInput = {
    number: 12,
    status: 'linked',
    reason: null,
    lastSyncedAt: new Date(NOW.getTime() - 60_000),
    summary: ADDED,
    rateLimitedUntil: undefined,
    pending: false,
    now: NOW,
    staleAfterSeconds: 3_600,
  };

  it('builds the link object, with the url from the stored owner and name', () => {
    expect(linkResponse(input)).toEqual({
      number: 12,
      url: 'https://github.com/darthjee/kerghan/issues/12',
      state: 'linked',
      states: ['linked'],
      reason: null,
      rateLimitedUntil: null,
      lastSyncedAt: '2026-11-17T11:59:00.000Z',
      stale: false,
    });
  });

  it('has a null url when the repository reference dangles, and reads repository_unavailable', () => {
    expect(linkResponse({ ...input, summary: undefined })).toMatchObject({
      url: null,
      state: 'repository_unavailable',
      states: ['repository_unavailable'],
    });
  });

  it('takes the primary state from the first of states and copies the reason', () => {
    expect(linkResponse({ ...input, status: 'sync_failed', reason: 'credential_invalid', pending: true })).toMatchObject({
      state: 'sync_failed',
      states: ['sync_failed', 'pending'],
      reason: 'credential_invalid',
    });
  });

  it('is stale only strictly past the threshold', () => {
    const at = (seconds: number): LinkResponseInput => ({ ...input, lastSyncedAt: new Date(NOW.getTime() - seconds * 1000) });

    expect(linkResponse(at(3_600)).stale).toBe(false);
    expect(linkResponse(at(3_601)).stale).toBe(true);
  });

  it('is never stale for a gone link', () => {
    expect(linkResponse({ ...input, status: 'gone', reason: 'deleted', lastSyncedAt: new Date(0) }).stale).toBe(false);
  });

  it('answers the reset time as an ISO string while waiting', () => {
    expect(linkResponse({ ...input, rateLimitedUntil: new Date('2026-11-17T12:05:00Z') })).toMatchObject({
      state: 'rate_limited',
      rateLimitedUntil: '2026-11-17T12:05:00.000Z',
    });
  });

  it('copies only the documented fields', () => {
    expect(Object.keys(linkResponse(input)).sort()).toEqual([
      'lastSyncedAt', 'number', 'rateLimitedUntil', 'reason', 'stale', 'state', 'states', 'url',
    ]);
  });
});

describe('IssueLinkPresenter', () => {
  const rawLink = {
    id: 5,
    issue_id: 9,
    github_number: 12,
    status: 'linked',
    status_reason: null,
    last_synced_at: new Date(NOW.getTime() - 1_000),
    created_at: NOW,
    user_id: 7,
    repository_id: 3,
  };

  class FakeWaits extends IssueRateLimitWaits {
    calls: number[][] = [];

    constructor(readonly until = new Map<number, Date>()) {
      super();
    }

    untilFor(linkIds: number[]): Map<number, Date> {
      this.calls.push(linkIds);
      return this.until;
    }
  }

  function build(links: unknown[], markers: unknown[], waits = new FakeWaits()): {
    presenter: IssueLinkPresenter;
    query: jest.Mock;
    repositories: FakeProjectRepositories;
  } {
    const query = jest.fn(async (sql: string) => (sql.includes('issues_github_links') ? links : markers));
    const repositories = new FakeProjectRepositories().seed(7, { repositoryId: 3, githubId: 30, owner: 'darthjee', name: 'kerghan' });
    const dataSource = { manager: { query } } as unknown as DataSource;
    const config = new IssuesConfig({ get: () => undefined } as never);

    return {
      query,
      repositories,
      presenter: new IssueLinkPresenter(dataSource, repositories as unknown as RepositoriesService, waits, config, new FakeClock(NOW)),
    };
  }

  it('answers an empty map without a query for no issue ids', async () => {
    const { presenter, query } = build([], []);

    expect((await presenter.forIssues([])).size).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it('answers no entry for an unlinked issue and stops after the links query', async () => {
    const { presenter, query } = build([], []);

    expect((await presenter.forIssues([9])).size).toBe(0);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('builds the link object by issue id, with a pending marker', async () => {
    const { presenter } = build([rawLink], [{ link_id: 5 }]);
    const link = (await presenter.forIssues([9])).get(9);

    expect(link).toMatchObject({ number: 12, url: 'https://github.com/darthjee/kerghan/issues/12', state: 'pending', states: ['pending'] });
  });

  it('reads rateLimitedUntil through the port', async () => {
    const waits = new FakeWaits(new Map([[5, new Date('2026-11-17T12:10:00Z')]]));
    const { presenter } = build([rawLink], [], waits);
    const link = (await presenter.forIssues([9])).get(9);

    expect(waits.calls).toEqual([[5]]);
    expect(link).toMatchObject({ state: 'rate_limited', rateLimitedUntil: '2026-11-17T12:10:00.000Z' });
  });

  it('shows rate_limited with rateLimitedUntil while the link waits in the real pauses, and not after the reset', async () => {
    const clock = new FakeClock(NOW);
    const pauses = new IssueRateLimitPauses(
      clock,
      new FakeScheduler(clock),
      { enqueue: jest.fn() },
      { markedAtFor: jest.fn(async () => new Map()) } as never,
      { error: jest.fn() } as never,
    );
    const { presenter } = build([rawLink], [], pauses as unknown as FakeWaits);

    pauses.pause(41, new Date('2026-11-17T12:10:00Z'));
    pauses.wait(41, 5);

    expect((await presenter.forIssues([9])).get(9)).toMatchObject({
      state: 'rate_limited',
      states: ['rate_limited'],
      rateLimitedUntil: '2026-11-17T12:10:00.000Z',
    });

    pauses.release(5);

    expect((await presenter.forIssues([9])).get(9)).toMatchObject({ state: 'linked', rateLimitedUntil: null });
  });

  it('falls back to created_at when last_synced_at is null', async () => {
    const { presenter } = build([{ ...rawLink, last_synced_at: null }], []);

    expect((await presenter.forIssues([9])).get(9)?.lastSyncedAt).toBe(NOW.toISOString());
  });

  it('reads a dangling repository as repository_unavailable with a null url', async () => {
    const { presenter } = build([{ ...rawLink, repository_id: 99 }], []);

    expect((await presenter.forIssues([9])).get(9)).toMatchObject({ url: null, state: 'repository_unavailable' });
  });

  it('reads through the given transaction manager, and asks for the summaries once', async () => {
    const { presenter, query, repositories } = build([rawLink, { ...rawLink, id: 6, issue_id: 10 }], []);
    const manager = { query: jest.fn(async (sql: string) => (sql.includes('issues_github_links') ? [rawLink] : [])) };

    await presenter.forIssues([9], manager as unknown as EntityManager);

    expect(manager.query).toHaveBeenCalledTimes(2);
    expect(query).not.toHaveBeenCalled();

    await presenter.forIssues([9, 10]);

    expect(repositories.callsOf('projectSummaries')).toBe(2);
  });
});
