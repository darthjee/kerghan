import type request from 'supertest';
import { issue as issueCase, githubIssue } from '../../../integrations/tests/support/github-builders.js';
import type { GithubIssue } from '../../../integrations/integrations-github.public.js';
import { seedUser } from '../../../repositories/tests/support/two-user-baseline.js';
import { integrationRef } from './integration-refs.js';
import type { IssuesHttpDbHarness } from './issues-http-db-harness.js';
import { post } from './issues-http-db-harness.js';
import { seedProject, type SeededProject } from './issues-seeds.js';

/** The integration that lists the fixture's repository. */
export const INTEGRATION_ID = 41;
/** The fixture repository's internal id. */
export const REPOSITORY_ID = 7001;
/** The fixture repository's GitHub id and names. */
export const REPOSITORY = { githubId: 700, owner: 'darthjee', name: 'kerghan' } as const;

/** A user with a project linked to a repository that one integration can read. */
export interface LinkWorld {
  userId: number;
  cookie: string;
  project: SeededProject;
}

let run = 0;

/**
 * Gives the next test a fresh link rate-limit window (user ids repeat after each truncate), clears
 * the in-memory Repositories and GitHub state, and seeds one user with a project.
 * @param harness - The harness.
 * @param username - The user to seed (default `owner`).
 * @returns The user, their session cookie and their project.
 */
export async function buildLinkWorld(harness: IssuesHttpDbHarness, username = 'owner'): Promise<LinkWorld> {
  run += 1;
  harness.clock.set(new Date(Date.UTC(2026, 5, 1, 12, 0, 0) + run * 3_600_000));
  harness.repositories.reset();
  harness.github.calls.length = 0;

  const userId = await seedUser(harness.ds, username);

  linkRepository(harness, userId);

  return { userId, cookie: harness.sessionFor(userId), project: await seedProject(harness.ds, userId, { repositoryId: REPOSITORY_ID }) };
}

/**
 * Seeds the fixture repository for a user: listed by `INTEGRATION_ID`, which is usable.
 * @param harness - The harness.
 * @param userId - The user.
 * @param status - The row's status (default `added`).
 * @returns Nothing.
 */
export function linkRepository(harness: IssuesHttpDbHarness, userId: number, status: 'added' | 'unavailable' | 'unknown' = 'added'): void {
  harness.repositories.seed(userId, { repositoryId: REPOSITORY_ID, ...REPOSITORY, status, integrationSourceIds: [INTEGRATION_ID] });
  harness.github.setUsable(userId, [integrationRef(INTEGRATION_ID)]);
}

/**
 * Scripts GitHub to answer a number with an issue.
 * @param harness - The harness.
 * @param attributes - The issue's fields (the number defaults to 12).
 * @returns The scripted issue.
 */
export function scriptIssue(harness: IssuesHttpDbHarness, attributes: Partial<GithubIssue> = {}): GithubIssue {
  const github = githubIssue({ number: 12, ...attributes });

  harness.github.script(INTEGRATION_ID, 'getIssue', github.number, issueCase(github));

  return github;
}

/** The three link routes as a user. */
export interface LinkApi {
  importIssue(body?: Record<string, unknown>): request.Test;
  attach(issueUuid: string, body?: Record<string, unknown>): request.Test;
  unlink(issueUuid: string, body?: Record<string, unknown>): request.Test;
}

/**
 * The link routes of a project, called as a session.
 * @param harness - The harness.
 * @param world - The user and project.
 * @param cookie - The session cookie (default the world's).
 * @returns The calls.
 */
export function linkApi(harness: IssuesHttpDbHarness, world: LinkWorld, cookie = world.cookie): LinkApi {
  const base = `/projects/${world.project.uuid}/issues`;

  return {
    importIssue: (body = { number: 12 }) => post(harness, `${base}/import.json`, cookie, body),
    attach: (issueUuid, body = { number: 12 }) => post(harness, `${base}/${issueUuid}/attach.json`, cookie, body),
    unlink: (issueUuid, body = {}) => post(harness, `${base}/${issueUuid}/unlink.json`, cookie, body),
  };
}

/**
 * Counts the rows of a table.
 * @param harness - The harness.
 * @param table - The table name.
 * @returns The row count.
 */
export async function rowCount(harness: IssuesHttpDbHarness, table: string): Promise<number> {
  const rows: Array<{ total: string }> = await harness.ds.query(`SELECT COUNT(*) AS total FROM ${table}`);

  return Number(rows[0].total);
}
