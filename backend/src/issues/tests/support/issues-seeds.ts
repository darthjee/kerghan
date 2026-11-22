import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { seedUser } from '../../../repositories/tests/support/two-user-baseline.js';
import { IssueGithubLink } from '../../entities/issue-github-link.entity.js';
import { IssuePendingWrite } from '../../entities/issue-pending-write.entity.js';
import { Issue, type IssueState } from '../../entities/issue.entity.js';
import { IssuesProject } from '../../entities/issues-project.entity.js';

/** The default timestamp of every seeded row (whole seconds, `datetime` keeps no fraction). */
export const SEED_TIME = new Date('2026-06-01T12:00:00Z');

/** A GitHub issue id above 2³¹, so every default link exercises `bigint`. */
const BASE_GITHUB_ISSUE_ID = 2 ** 31 + 1_000;

let nextGithubIssueId = BASE_GITHUB_ISSUE_ID;

/** What `seedProject` can set. */
export interface ProjectSeed {
  name?: string;
  description?: string | null;
  repositoryId?: number | null;
  /** Soft-deletes the project: `deleted_at` and `deleted_token = id` are written together. */
  deleted?: boolean;
}

/** The inserted project. */
export interface SeededProject {
  id: number;
  uuid: string;
}

/**
 * Inserts a project owned by `userId`, with a fresh `randomUUID()` and a unique name unless given.
 * @param ds - The data source.
 * @param userId - The owner.
 * @param seed - Optional fields.
 * @returns The project's internal id and uuid.
 */
export async function seedProject(ds: DataSource, userId: number, seed: ProjectSeed = {}): Promise<SeededProject> {
  const repository = ds.getRepository(IssuesProject);
  const uuid = randomUUID();
  const saved = await repository.save(repository.create({
    uuid,
    userId,
    name: seed.name ?? `project-${uuid.slice(0, 8)}`,
    description: seed.description ?? null,
    repositoryId: seed.repositoryId ?? null,
    deletedAt: null,
    deletedToken: 0,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  }));

  if (seed.deleted) {
    await repository.update({ id: saved.id }, { deletedAt: SEED_TIME, deletedToken: saved.id });
  }

  return { id: saved.id, uuid };
}

/** What `seedIssue` can set. */
export interface IssueSeed {
  title?: string;
  body?: string | null;
  state?: IssueState;
}

/** The inserted issue. */
export interface SeededIssue {
  id: number;
  uuid: string;
}

/**
 * Inserts an issue of `projectId`, with a fresh `randomUUID()`.
 * @param ds - The data source.
 * @param projectId - The internal id of the project.
 * @param seed - Optional fields.
 * @returns The issue's internal id and uuid.
 */
export async function seedIssue(ds: DataSource, projectId: number, seed: IssueSeed = {}): Promise<SeededIssue> {
  const repository = ds.getRepository(Issue);
  const uuid = randomUUID();
  const saved = await repository.save(repository.create({
    uuid,
    projectId,
    title: seed.title ?? `issue-${uuid.slice(0, 8)}`,
    body: seed.body ?? null,
    state: seed.state ?? 'open',
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  }));

  return { id: saved.id, uuid };
}

/** What `seedLink` can set; `userId` and `issueId` are required. */
export interface LinkSeed {
  userId: number;
  issueId: number;
  githubIssueId?: number;
  githubNumber?: number;
  status?: string;
  statusReason?: string | null;
  /** Defaults to `null` (the column is nullable); a link creation always sets it. */
  lastSyncedAt?: Date | null;
}

/**
 * Inserts the GitHub link of an issue, its base snapshot copied from the issue; the default
 * `github_issue_id` is above 2³¹.
 * @param ds - The data source.
 * @param seed - The owner, the issue and optional fields.
 * @returns The link's internal id.
 */
export async function seedLink(ds: DataSource, seed: LinkSeed): Promise<{ id: number }> {
  const issue = await ds.getRepository(Issue).findOneByOrFail({ id: seed.issueId });
  const repository = ds.getRepository(IssueGithubLink);
  const saved = await repository.save(repository.create({
    userId: seed.userId,
    issueId: seed.issueId,
    githubIssueId: seed.githubIssueId ?? nextGithubIssueId++,
    githubNumber: seed.githubNumber ?? 1,
    status: seed.status ?? 'linked',
    statusReason: seed.statusReason ?? null,
    baseTitle: issue.title,
    baseBody: issue.body,
    baseState: issue.state,
    githubUpdatedAt: null,
    lastSyncedAt: seed.lastSyncedAt ?? null,
    etag: null,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  }));

  return { id: saved.id };
}

/**
 * Inserts the pending marker of a link.
 * @param ds - The data source.
 * @param linkId - The internal id of the link.
 * @param seed - Optional fields.
 * @param seed.revision - The revision (default 1).
 * @param seed.markedAt - The `marked_at` time (default `SEED_TIME`).
 * @returns The marker's internal id.
 */
export async function seedMarker(
  ds: DataSource,
  linkId: number,
  seed: { revision?: number; markedAt?: Date } = {},
): Promise<{ id: number }> {
  const repository = ds.getRepository(IssuePendingWrite);
  const markedAt = seed.markedAt ?? SEED_TIME;
  const saved = await repository.save(repository.create({
    linkId,
    revision: seed.revision ?? 1,
    markedAt,
    updatedAt: markedAt,
  }));

  return { id: saved.id };
}

/** The intruder's ids, so a spec can assert that every one of his rows is untouched. */
export interface Intruder {
  userId: number;
  projectId: number;
  projectUuid: string;
  issueId: number;
  issueUuid: string;
  linkId: number;
  markerId: number;
}

/**
 * Seeds the intruder of `testing.md#fixtures`: a second user with a project, an issue, a link and
 * a marker of his own.
 * @param ds - The data source.
 * @returns The user's id and his rows' ids.
 */
export async function seedIntruder(ds: DataSource): Promise<Intruder> {
  const userId = await seedUser(ds, 'intruder');
  const project = await seedProject(ds, userId, { name: 'intruder project' });
  const issue = await seedIssue(ds, project.id, { title: 'intruder issue', body: 'intruder body' });
  const link = await seedLink(ds, { userId, issueId: issue.id });
  const marker = await seedMarker(ds, link.id);

  return {
    userId,
    projectId: project.id,
    projectUuid: project.uuid,
    issueId: issue.id,
    issueUuid: issue.uuid,
    linkId: link.id,
    markerId: marker.id,
  };
}
