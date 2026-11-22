import type { IssuesCanaryHarness } from './issues-canary-harness.js';
import { seedIssue, seedProject, type SeededIssue, type SeededProject } from './issues-seeds.js';
import { releaseQueuedLinks } from './sync-fixture.js';
import type { Integration } from '../../../integrations/entities/integration.entity.js';
import type { IntegrationType } from '../../../integrations/integration-enums.js';
import { seedUser } from '../../../repositories/tests/support/two-user-baseline.js';

/** The repository's internal id, GitHub id and names in the canary world. */
export const CANARY_REPOSITORY = { repositoryId: 7001, githubId: 700, owner: 'darthjee', name: 'kerghan' } as const;
/** The GitHub issue number every canary link uses. */
export const CANARY_NUMBER = 12;

/** The owner, their credentials, a project and a local issue, next to the harness's intruder. */
export interface CanaryWorld {
  userId: number;
  cookie: string;
  /** The owner's integrations, in the order given (oldest first), each holding a canary credential. */
  integrations: Integration[];
  project: SeededProject;
  /** A local, unlinked issue of the project. */
  issue: SeededIssue;
}

/** User content a world can carry, for the content canary: each field defaults to a plain value. */
export interface CanaryContent {
  projectName?: string;
  projectDescription?: string;
  issueTitle?: string;
  issueBody?: string;
  repositoryOwner?: string;
  repositoryName?: string;
}

let run = 0;

/**
 * Gives the next test a fresh clock hour and clean in-memory state, then seeds the owner with one
 * integration of each given type (a canary credential each), a project on a repository every one of
 * them lists, and a local issue.
 * @param harness - The canary harness.
 * @param types - The integration types, oldest first (default one PAT).
 * @param content - User content to seed (project name and description, issue title and body, repository owner and name).
 * @returns The world.
 */
export async function buildCanaryWorld(
  harness: IssuesCanaryHarness,
  types: IntegrationType[] = ['pat'],
  content: CanaryContent = {},
): Promise<CanaryWorld> {
  run += 1;
  harness.clock.set(new Date(Date.UTC(2026, 5, 1, 12, 0, 0) + run * 3_600_000));
  harness.repositories.reset();
  harness.github.clear();
  releaseQueuedLinks(harness);

  const userId = await seedUser(harness.ds, 'owner');
  const integrations: Integration[] = [];

  for (const type of types) integrations.push(await harness.seedIntegration(userId, { type }));

  harness.repositories.seed(userId, {
    ...CANARY_REPOSITORY,
    owner: content.repositoryOwner ?? CANARY_REPOSITORY.owner,
    name: content.repositoryName ?? CANARY_REPOSITORY.name,
    integrationSourceIds: integrations.map((integration) => integration.id),
  });

  const project = await seedProject(harness.ds, userId, {
    repositoryId: CANARY_REPOSITORY.repositoryId,
    ...(content.projectName === undefined ? {} : { name: content.projectName }),
    description: content.projectDescription ?? null,
  });
  const issue = await seedIssue(harness.ds, project.id, { title: content.issueTitle ?? 'Local', body: content.issueBody ?? 'Local body' });

  return { userId, cookie: harness.sessionFor(userId), integrations, project, issue };
}
