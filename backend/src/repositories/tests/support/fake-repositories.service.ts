import type { RequestReconciliation } from '../../handle-reconciler.js';
import type { RepositoriesService } from '../../repositories.service.js';
import type {
  FoundRepository,
  IntegrationSummary,
  ListedRepository,
  ListInput,
  ListResult,
  MarkAddedOutcome,
  RepoRef,
  RepositorySnapshot,
  SyncStateResult,
  TriggerOutcome,
} from '../../types/repositories-api.types.js';

/** The methods of `RepositoriesService` the HTTP layer uses. */
export type RepositoriesServiceSurface = Pick<
  RepositoriesService,
  'list' | 'syncState' | 'triggerIfStale' | 'refresh' | 'reconcileForRequest' | 'findByRef' | 'markAdded'
>;

/** One logged call. */
export interface FakeRepositoriesCall {
  method: keyof RepositoriesServiceSurface;
  userId: number;
  args: unknown[];
}

/** A seeded row: the listing row plus Add's candidate inputs. */
export interface FakeRepoSeed extends Partial<Omit<ListedRepository, 'githubId'>> {
  githubId: number;
  holderIntegrationIds?: number[];
  handleSeesRepo?: boolean;
}

const SEEN_AT = new Date('2026-11-07T12:00:00Z');

/** The idle, never-synced sync state. */
export function idleSyncState(): SyncStateResult {
  return { state: 'idle', startedAt: null, lastSyncedAt: null, refreshAvailableAt: null, sources: [] };
}

/**
 * Builds a listing row.
 * @param seed - The row's fields.
 * @returns The row.
 */
export function listedRepository(seed: FakeRepoSeed): ListedRepository {
  const owner = seed.owner ?? 'octo';
  const name = seed.name ?? `repo-${seed.githubId}`;
  const addedAt = seed.addedAt ?? null;

  return {
    githubId: seed.githubId,
    owner,
    name,
    fullName: `${owner}/${name}`,
    private: seed.private ?? false,
    status: seed.status ?? (addedAt === null ? 'not_added' : 'added'),
    addedAt,
    lastSeenAt: seed.lastSeenAt ?? SEEN_AT,
    sources: seed.sources ?? [],
    accessIntegration: seed.accessIntegration ?? null,
  };
}

/**
 * A typed, in-memory `RepositoriesService` for the HTTP-layer specs (the
 * real one runs MySQL SQL). Rows are per user; `findByRef` / `markAdded`
 * follow the real lookup rules (a `fullName` matches case-insensitively, a
 * `githubId` exactly, only among the caller's rows). Every other answer is
 * set by hand. `calls` logs every call.
 */
export class FakeRepositoriesService implements RepositoriesServiceSurface {
  readonly calls: FakeRepositoriesCall[] = [];
  readonly #rows = new Map<number, FoundRepository[]>();
  readonly #noUsers = new Set<number>();
  readonly #syncStates = new Map<number, SyncStateResult>();
  readonly #triggers = new Map<number, TriggerOutcome>();
  readonly #refreshes = new Map<number, TriggerOutcome>();
  #now: () => Date = () => new Date('2026-11-07T12:30:00Z');
  #markGone = false;
  #linkSummary: (userId: number, integrationId: number) => IntegrationSummary | null = () => null;

  seed(userId: number, seed: FakeRepoSeed): this {
    const found: FoundRepository = {
      repository: listedRepository(seed),
      holderIntegrationIds: seed.holderIntegrationIds ?? [],
      handleSeesRepo: seed.handleSeesRepo ?? false,
    };

    this.#rows.set(userId, [...(this.#rows.get(userId) ?? []), found]);
    return this;
  }

  rowsOf(userId: number): ListedRepository[] {
    return (this.#rows.get(userId) ?? []).map((row) => row.repository);
  }

  markNoUser(userId: number): this {
    this.#noUsers.add(userId);
    return this;
  }

  setSyncState(userId: number, state: SyncStateResult): this {
    this.#syncStates.set(userId, state);
    return this;
  }

  setTrigger(userId: number, outcome: TriggerOutcome): this {
    this.#triggers.set(userId, outcome);
    return this;
  }

  setRefresh(userId: number, outcome: TriggerOutcome): this {
    this.#refreshes.set(userId, outcome);
    return this;
  }

  setNow(now: () => Date): this {
    this.#now = now;
    return this;
  }

  /** Makes the next `markAdded` calls answer `gone` (the row was pruned meanwhile). */
  pruneOnMark(): this {
    this.#markGone = true;
    return this;
  }

  setLinkSummary(resolve: (userId: number, integrationId: number) => IntegrationSummary | null): this {
    this.#linkSummary = resolve;
    return this;
  }

  callsOf(method: keyof RepositoriesServiceSurface): FakeRepositoriesCall[] {
    return this.calls.filter((call) => call.method === method);
  }

  async list(userId: number, input: ListInput): Promise<ListResult> {
    this.#log('list', userId, input);
    const all = this.rowsOf(userId).filter((row) => input.filter === 'all' || row.status === input.filter);
    const start = (input.page - 1) * input.perPage;

    return {
      repositories: all.slice(start, start + input.perPage),
      page: input.page,
      perPage: input.perPage,
      total: all.length,
      totalPages: Math.ceil(all.length / input.perPage),
    };
  }

  async syncState(userId: number): Promise<SyncStateResult> {
    this.#log('syncState', userId);
    return this.#syncStates.get(userId) ?? idleSyncState();
  }

  async triggerIfStale(userId: number): Promise<TriggerOutcome> {
    this.#log('triggerIfStale', userId);
    return this.#noUsers.has(userId) ? { kind: 'no_user' } : this.#triggers.get(userId) ?? { kind: 'fresh' };
  }

  async refresh(userId: number): Promise<TriggerOutcome> {
    this.#log('refresh', userId);
    return this.#noUsers.has(userId) ? { kind: 'no_user' } : this.#refreshes.get(userId) ?? { kind: 'started' };
  }

  async reconcileForRequest(userId: number): Promise<RequestReconciliation> {
    this.#log('reconcileForRequest', userId);
    return this.#noUsers.has(userId) ? { kind: 'no_user' } : { kind: 'ok', handle: null };
  }

  async findByRef(userId: number, ref: RepoRef): Promise<FoundRepository | null> {
    this.#log('findByRef', userId, ref);
    return this.#find(userId, ref);
  }

  async markAdded(userId: number, ref: RepoRef, integrationId: number | null, snapshot?: RepositorySnapshot): Promise<MarkAddedOutcome> {
    this.#log('markAdded', userId, ref, integrationId, snapshot);
    const found = this.#find(userId, ref);

    if (found === null || this.#markGone) return { kind: 'gone' };
    if (found.repository.addedAt !== null) return { kind: 'already_added', repository: found.repository };

    found.repository = {
      ...found.repository,
      ...snapshot,
      ...(snapshot === undefined ? {} : { fullName: `${snapshot.owner}/${snapshot.name}` }),
      status: 'added',
      addedAt: this.#now(),
      accessIntegration: integrationId === null ? null : this.#linkSummary(userId, integrationId),
    };

    return { kind: 'added', repository: found.repository };
  }

  #find(userId: number, ref: RepoRef): FoundRepository | null {
    const rows = this.#rows.get(userId) ?? [];
    const matches = 'githubId' in ref
      ? rows.filter((row) => row.repository.githubId === ref.githubId)
      : rows.filter((row) => row.repository.fullName.toLowerCase() === ref.fullName.toLowerCase());

    return matches[0] ?? null;
  }

  #log(method: keyof RepositoriesServiceSurface, userId: number, ...args: unknown[]): void {
    this.calls.push({ method, userId, args });
  }
}
