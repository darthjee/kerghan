import type { RepositoriesService } from '../../../repositories/repositories.service.js';
import type { RowStatus } from '../../../repositories/row-status.js';
import type {
  ProjectRepositoryLookup,
  RepoRef,
  RepositorySummary,
} from '../../../repositories/types/repositories-api.types.js';

/** A seeded repository row of one user. */
export interface FakeProjectRepoSeed {
  repositoryId: number;
  githubId: number;
  owner?: string;
  name?: string;
  private?: boolean;
  status?: RowStatus;
  /** Defaults to `true`; `false` makes the row "not added". */
  added?: boolean;
}

/** The two `RepositoriesService` methods the Projects services use. */
export type ProjectRepositoriesSurface = Pick<RepositoriesService, 'resolveForProject' | 'projectSummaries'>;

/**
 * An in-memory stand-in for the two `RepositoriesService` lookups the Issues module uses
 * (`resolveForProject`, `projectSummaries`): rows are per user, a `fullName` matches
 * case-insensitively, a `githubId` exactly, only among the caller's rows. The real queries are
 * proven by `repositories.service.project-lookups.db-spec.ts`. `calls` logs every call.
 */
export class FakeProjectRepositories implements ProjectRepositoriesSurface {
  readonly calls: Array<{ method: keyof ProjectRepositoriesSurface; userId: number; args: unknown[] }> = [];
  readonly #rows = new Map<number, Array<ProjectRepositoryLookup>>();

  seed(userId: number, seed: FakeProjectRepoSeed): this {
    const owner = seed.owner ?? 'octo';
    const name = seed.name ?? `repo-${seed.githubId}`;
    const added = seed.added ?? true;
    const summary: RepositorySummary = {
      githubId: seed.githubId,
      owner,
      name,
      fullName: `${owner}/${name}`,
      private: seed.private ?? false,
      status: seed.status ?? (added ? 'added' : 'not_added'),
    };

    this.#rows.set(userId, [...(this.#rows.get(userId) ?? []), { repositoryId: seed.repositoryId, added, summary }]);

    return this;
  }

  /** Renames a seeded row (the repository moved or was renamed on GitHub): its summary follows. */
  rename(userId: number, repositoryId: number, owner: string, name: string): this {
    const row = (this.#rows.get(userId) ?? []).find((candidate) => candidate.repositoryId === repositoryId);

    if (row) Object.assign(row.summary, { owner, name, fullName: `${owner}/${name}` });

    return this;
  }

  async resolveForProject(userId: number, ref: RepoRef): Promise<ProjectRepositoryLookup | null> {
    this.calls.push({ method: 'resolveForProject', userId, args: [ref] });
    const rows = this.#rows.get(userId) ?? [];
    const found = 'githubId' in ref
      ? rows.find((row) => row.summary.githubId === ref.githubId)
      : rows.find((row) => row.summary.fullName.toLowerCase() === ref.fullName.toLowerCase());

    return found ?? null;
  }

  async projectSummaries(userId: number, repositoryIds: number[]): Promise<Map<number, RepositorySummary>> {
    this.calls.push({ method: 'projectSummaries', userId, args: [repositoryIds] });
    const rows = this.#rows.get(userId) ?? [];

    return new Map(rows.filter((row) => repositoryIds.includes(row.repositoryId)).map((row) => [row.repositoryId, row.summary]));
  }

  callsOf(method: keyof ProjectRepositoriesSurface): number {
    return this.calls.filter((call) => call.method === method).length;
  }
}
