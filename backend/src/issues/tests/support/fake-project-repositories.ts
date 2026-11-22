import type { RepositoriesService } from '../../../repositories/repositories.service.js';
import type { RowStatus } from '../../../repositories/row-status.js';
import type {
  ProjectRepositoryLookup,
  RepoRef,
  RepositoryRename,
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
  /** The ids of the integrations whose source lists the row (default none); a handle is never listed. */
  integrationSourceIds?: number[];
}

/** The `RepositoriesService` methods the Issues module uses. */
export type ProjectRepositoriesSurface = Pick<RepositoriesService, 'resolveForProject' | 'projectSummaries' | 'integrationSourceIds' | 'applyRename'>;

/**
 * An in-memory stand-in for the `RepositoriesService` lookups the Issues module uses
 * (`resolveForProject`, `projectSummaries`, `integrationSourceIds`): rows are per user, a `fullName` matches
 * case-insensitively, a `githubId` exactly, only among the caller's rows. The real queries are
 * proven by `repositories.service.project-lookups.db-spec.ts`. `calls` logs every call.
 */
export class FakeProjectRepositories implements ProjectRepositoriesSurface {
  readonly calls: Array<{ method: keyof ProjectRepositoriesSurface; userId: number; args: unknown[] }> = [];
  readonly #rows = new Map<number, Array<ProjectRepositoryLookup>>();
  readonly #sources = new Map<string, number[]>();

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

    const others = (this.#rows.get(userId) ?? []).filter((row) => row.repositoryId !== seed.repositoryId);

    this.#rows.set(userId, [...others, { repositoryId: seed.repositoryId, added, summary }]);
    this.#sources.set(`${userId}:${seed.repositoryId}`, [...(seed.integrationSourceIds ?? [])]);

    return this;
  }

  /** Forgets every seeded row and logged call (user ids restart between DB specs). */
  reset(): this {
    this.#rows.clear();
    this.#sources.clear();
    this.calls.length = 0;

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

  async integrationSourceIds(userId: number, repositoryId: number): Promise<number[]> {
    this.calls.push({ method: 'integrationSourceIds', userId, args: [repositoryId] });

    return [...(this.#sources.get(`${userId}:${repositoryId}`) ?? [])];
  }

  async applyRename(userId: number, repositoryId: number, renamedTo: RepositoryRename): Promise<void> {
    this.calls.push({ method: 'applyRename', userId, args: [repositoryId, renamedTo] });
    this.rename(userId, repositoryId, renamedTo.owner, renamedTo.name);
  }

  callsOf(method: keyof ProjectRepositoriesSurface): number {
    return this.calls.filter((call) => call.method === method).length;
  }
}
