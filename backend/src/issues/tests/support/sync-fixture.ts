import { integrationRef } from './integration-refs.js';
import type { IssuesDbHarness } from './issues-db-harness.js';
import { seedIssue, seedLink, seedMarker, seedProject, SEED_TIME } from './issues-seeds.js';
import type { GithubIssue } from '../../../integrations/integrations-github.public.js';
import { githubIssue } from '../../../integrations/tests/support/github-builders.js';
import { issue as issueCase } from '../../../integrations/tests/support/github-builders.js';
import { seedUser } from '../../../repositories/tests/support/two-user-baseline.js';
import { IssueGithubLink } from '../../entities/issue-github-link.entity.js';
import { IssuePendingWrite } from '../../entities/issue-pending-write.entity.js';
import { Issue, type IssueState } from '../../entities/issue.entity.js';
import { IssueSyncQueue } from '../../issue-sync-queue.js';
import { ISSUES_RECONCILE_JOB } from '../../jobs/issues-reconcile.job.js';

/** The integration that lists the sync fixture's repository. */
export const SYNC_INTEGRATION = 41;
/** The sync fixture repository's internal id. */
export const SYNC_REPOSITORY_ID = 7001;
/** The sync fixture repository's GitHub id and names. */
export const SYNC_REPOSITORY = { githubId: 700, owner: 'darthjee', name: 'kerghan' } as const;
/** The GitHub issue number of every fixture link. */
export const SYNC_NUMBER = 12;

/** The three synced values. */
export interface SyncValues {
  title: string;
  body: string | null;
  state: IssueState;
}

/** What `buildSyncWorld` can set. */
export interface SyncWorldOptions {
  /** The Kerghan issue's values (default `T`, `B`, `open`). */
  local?: Partial<SyncValues>;
  /** The link's base snapshot (default `T`, `B`, `open`, whatever the local values are). */
  base?: Partial<SyncValues>;
  /** A pending marker, with its revision and `Tm` (default: no marker). */
  marker?: { revision?: number; updatedAt?: Date } | null;
  status?: string;
  statusReason?: string | null;
  etag?: string | null;
  githubUpdatedAt?: Date | null;
  /** The usable integrations of the user, all listing the repository (default `[41]`). */
  integrations?: number[];
}

/** The ids of what the fixture seeded. */
export interface SyncWorld {
  userId: number;
  projectId: number;
  issueId: number;
  linkId: number;
}

let run = 0;

/**
 * Clears the in-memory state of the previous spec, moves the clock to a fresh hour (so a pause of an
 * earlier spec has ended), and seeds a user with a project on a repository that one or more
 * integrations list, one issue with a link, and optionally a marker.
 * @param harness - The harness.
 * @param options - What to seed.
 * @returns The ids.
 */
export async function buildSyncWorld(harness: IssuesDbHarness, options: SyncWorldOptions = {}): Promise<SyncWorld> {
  run += 1;
  harness.clock.set(new Date(Date.UTC(2026, 6, 1, 12, 0, 0) + run * 3_600_000));
  harness.repositories.reset();
  harness.github.calls.length = 0;
  // Jobs of the previous spec that never ran still count as queued: start them, so their links can queue again.
  for (const params of harness.workers.paramsOf(ISSUES_RECONCILE_JOB)) harness.get(IssueSyncQueue).started(params.linkId as number);

  harness.workers.reset();

  const userId = await seedUser(harness.ds, 'owner');
  const integrations = options.integrations ?? [SYNC_INTEGRATION];

  harness.repositories.seed(userId, { repositoryId: SYNC_REPOSITORY_ID, ...SYNC_REPOSITORY, integrationSourceIds: integrations });
  harness.github.setUsable(userId, integrations.map((id) => integrationRef(id)));

  const project = await seedProject(harness.ds, userId, { repositoryId: SYNC_REPOSITORY_ID });
  const issue = await seedIssue(harness.ds, project.id, { title: 'T', body: 'B', state: 'open', ...options.local });
  const link = await seedLink(harness.ds, {
    userId,
    issueId: issue.id,
    githubNumber: SYNC_NUMBER,
    status: options.status,
    statusReason: options.statusReason,
    etag: options.etag,
    githubUpdatedAt: options.githubUpdatedAt ?? new Date('2026-06-01T11:00:00Z'),
    lastSyncedAt: SEED_TIME,
    base: { title: 'T', body: 'B', state: 'open', ...options.base },
  });

  if (options.marker !== undefined && options.marker !== null) await seedMarker(harness.ds, link.id, options.marker);

  return { userId, projectId: project.id, issueId: issue.id, linkId: link.id };
}

/**
 * Scripts `getIssue` of the fixture number on an integration.
 * @param harness - The harness.
 * @param integrationId - The integration.
 * @param answers - The answers, used in order (the last one sticks).
 * @returns Nothing.
 */
export function scriptGet(harness: IssuesDbHarness, integrationId: number, ...answers: Parameters<IssuesDbHarness['github']['script']>[3][]): void {
  harness.github.script(integrationId, 'getIssue', SYNC_NUMBER, ...answers);
}

/**
 * A GitHub issue of the fixture number, as an `issue(...)` case.
 * @param attributes - The issue's fields (default `T`, `B`, `open`, updated at 11:00).
 * @param etag - The case's `ETag`.
 * @returns The case.
 */
export function githubCase(attributes: Partial<GithubIssue> = {}, etag = 'W/"g1"'): ReturnType<typeof issueCase> {
  return issueCase(githubIssue({ number: SYNC_NUMBER, title: 'T', body: 'B', state: 'open', updatedAt: new Date('2026-06-01T11:00:00Z'), ...attributes }), { etag });
}

/** The rows a spec asserts on. */
export interface SyncState {
  issue: Issue;
  link: IssueGithubLink;
  marker: IssuePendingWrite | null;
}

/**
 * Reads the world's issue, link and marker back.
 * @param harness - The harness.
 * @param world - The ids.
 * @returns The rows.
 */
export async function readState(harness: IssuesDbHarness, world: SyncWorld): Promise<SyncState> {
  return {
    issue: await harness.ds.getRepository(Issue).findOneByOrFail({ id: world.issueId }),
    link: await harness.ds.getRepository(IssueGithubLink).findOneByOrFail({ id: world.linkId }),
    marker: await harness.ds.getRepository(IssuePendingWrite).findOneBy({ linkId: world.linkId }),
  };
}
