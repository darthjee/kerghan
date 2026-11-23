import { isDeepStrictEqual } from 'node:util';
import type { CanaryWorld } from './canary-world.js';
import { CANARY_NUMBER } from './canary-world.js';
import type { IssuesCanaryHarness } from './issues-canary-harness.js';
import { seedLink, seedMarker } from './issues-seeds.js';
import type { ScriptedGithub } from './scripted-github.js';
import {
  forbidden, githubIssue, issue as issueCase, issuePage, notFound, rateLimited, serverError, timeout, unauthorized, type GithubCase,
} from '../../../integrations/tests/support/github-builders.js';
import { ISSUES_RECONCILE_JOB } from '../../jobs/issues-reconcile.job.js';

/** What GitHub's copy of the issue holds when a script builds an answer. */
export interface RemoteValues {
  /** GitHub's title when it differs from the link's base (default `Base`). */
  title: string;
  body: string;
  /** The title edited locally (the pending write's value; default `Local`). */
  local: string;
  /** The clock, for the reset of a rate limit. */
  now: Date;
}

/** One sync outcome of `docs/agents/modules/issues/testing.md#security-verification`: how the world is arranged and what GitHub answers. */
export interface SyncOutcome {
  /** The title of the test, with its edge-case id. */
  title: string;
  /** Seeds no integration at all (E20). */
  noIntegration?: boolean;
  /** Denies the owner before the job runs (E24). */
  denyOwner?: boolean;
  /** Scripts GitHub for the job. */
  script(github: ScriptedGithub, remote: RemoteValues): void;
  /** Asserts what the job left behind (throws on a failed expectation). */
  verify?(harness: IssuesCanaryHarness, world: CanaryWorld): Promise<void>;
}

/**
 * GitHub's issue 12 as the link last saw it, or as it changed.
 * @param remote - The values.
 * @param title - The title (default the link's base title).
 * @param updatedAt - GitHub's `updated_at`.
 * @param etag - The `ETag`.
 * @returns The case.
 */
export function remoteIssue(remote: RemoteValues, title = remote.title, updatedAt = '2026-06-01T11:00:00Z', etag = 'W/"g1"'): GithubCase {
  return issueCase(githubIssue({ number: CANARY_NUMBER, title, body: remote.body, updatedAt: new Date(updatedAt) }), { etag });
}

/**
 * Links the world's issue to GitHub issue 12 (base title `Base`), with a pending write when asked.
 * @param harness - The harness.
 * @param world - The world.
 * @param marker - Whether to leave a pending write.
 * @returns The link's internal id.
 */
export async function linkIssue(harness: IssuesCanaryHarness, world: CanaryWorld, marker = false): Promise<number> {
  const link = await seedLink(harness.ds, {
    userId: world.userId,
    issueId: world.issue.id,
    githubNumber: CANARY_NUMBER,
    etag: 'W/"old"',
    githubUpdatedAt: new Date('2026-06-01T11:00:00Z'),
    lastSyncedAt: harness.clock.now(),
    base: { title: 'Base', body: 'Local body', state: 'open' },
  });

  if (marker) await seedMarker(harness.ds, link.id);

  return link.id;
}

const statusOf = async (harness: IssuesCanaryHarness, world: CanaryWorld): Promise<unknown[]> => harness.ds.query(
  'SELECT status, status_reason FROM issues_github_links WHERE user_id = ?', [world.userId],
);

const stays = (status: string, reason: string | null) => async (harness: IssuesCanaryHarness, world: CanaryWorld): Promise<void> => {
  const markers: unknown[] = await harness.ds.query('SELECT id FROM issues_pending_writes WHERE link_id IN (SELECT id FROM issues_github_links WHERE user_id = ?)', [world.userId]);

  if (markers.length !== 1) throw new Error(`expected the marker to stay, found ${markers.length}`);
  if (!isDeepStrictEqual(await statusOf(harness, world), [{ status, status_reason: reason }])) throw new Error(`expected the link to be ${status}/${String(reason)}`);
};

/** Every sync outcome the sweeps drive the reconcile job through. */
export const SYNC_OUTCOMES: SyncOutcome[] = [
  {
    title: 'success: the pending write is pushed',
    script: (github, remote) => github.reads(remoteIssue(remote)).writes(remoteIssue(remote, remote.local, '2026-06-01T13:00:00Z', 'W/"g2"')),
    verify: async (harness) => {
      if (harness.github.issueCalls().map((call) => call.method).join() !== 'GET,PATCH') throw new Error('expected a GET then a PATCH');
    },
  },
  {
    title: 'E17: a rate limit pauses the integration',
    script: (github, remote) => github.reads(rateLimited(new Date(remote.now.getTime() + 600_000))),
    verify: stays('linked', null),
  },
  {
    title: 'E19: a revoked credential (401) stops the job and keeps the marker',
    script: (github) => github.reads(unauthorized()),
  },
  {
    title: 'E21 and E5: a read-only credential (403 on the push) fails with a credential reason',
    script: (github, remote) => github.reads(remoteIssue(remote)).writes(forbidden()),
    verify: stays('sync_failed', 'forbidden'),
  },
  ...([
    ['a failing probe (403): access loss', forbidden],
    ['a failing probe (401): access loss', unauthorized],
    ['a failing probe (404): access loss', notFound],
    ['a failing probe (5xx): unavailable', serverError],
    ['a passing probe: the link is gone', () => issuePage([])],
  ] as Array<[string, () => GithubCase]>).map(([label, probe]): SyncOutcome => ({
    title: `E22: a 404 with ${label}`,
    script: (github) => github.reads(notFound()).probes(probe()),
  })),
  ...([['a timeout', timeout], ['a 5xx', serverError]] as Array<[string, () => GithubCase]>).map(([label, answer]): SyncOutcome => ({
    title: `exhausted retries: ${label} exhausts the attempts and records the failure`,
    script: (github) => github.reads(answer()),
    verify: stays('sync_failed', 'retries_exhausted'),
  })),
  {
    title: 'E20: no integration at all makes no GitHub call and keeps the marker',
    noIntegration: true,
    script: () => undefined,
    verify: async (harness, world) => {
      if (harness.github.calls.length > 0) throw new Error('expected no GitHub call');
      await stays('sync_failed', 'no_credential')(harness, world);
    },
  },
  {
    title: 'E24: an owner who is not approved makes no fetch call and keeps the markers',
    denyOwner: true,
    script: (github, remote) => github.reads(remoteIssue(remote)).writes(remoteIssue(remote, remote.local)),
    verify: async (harness, world) => {
      if (harness.github.fetch.mock.calls.length > 0) throw new Error('expected no fetch call');
      await stays('linked', null)(harness, world);
    },
  },
];

/**
 * Leaves one pending write (the issue's title edited to `remote.local`, over the link's base `Base`) and
 * runs the reconcile job through the outcome with the real job and its retries.
 * @param harness - The harness.
 * @param world - The world (built with no integration for E20).
 * @param outcome - The outcome.
 * @param remote - The values GitHub's copy holds.
 * @returns Resolves when the queue is drained and the outcome's expectation holds.
 */
export async function runOutcome(harness: IssuesCanaryHarness, world: CanaryWorld, outcome: SyncOutcome, remote: Partial<RemoteValues> = {}): Promise<void> {
  const linkId = await linkIssue(harness, world, true);

  const values: RemoteValues = { title: 'Base', body: 'Local body', local: 'Local', now: harness.clock.now(), ...remote };

  await harness.ds.query('UPDATE issues SET title = ? WHERE id = ?', [values.local, world.issue.id]);
  if (outcome.denyOwner) await harness.ds.query("UPDATE auth_users SET status = 'denied' WHERE id = ?", [world.userId]);

  outcome.script(harness.github, values);
  harness.workers.enqueue(ISSUES_RECONCILE_JOB, { linkId });
  await harness.drainJobs();
  await outcome.verify?.(harness, world);
}
