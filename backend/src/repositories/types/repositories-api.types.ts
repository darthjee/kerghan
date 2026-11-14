import type { RowStatus } from '../row-status.js';

/**
 * The typed surface of `RepositoriesService` (`docs/agents/backend/routes/repositories.md`):
 * plain inputs and outputs, no HTTP types and no DTO classes (the controller
 * owns validation and response shaping). The internal repository `id` never
 * appears here.
 */

/** The listing filters (`unknown` rows show only under `all`). */
export type ListFilter = 'all' | 'added' | 'not_added' | 'unavailable';

/** The listing's validated input. */
export interface ListInput {
  /** 1-based page. */
  page: number;
  perPage: number;
  filter: ListFilter;
  /** Trimmed literal substring of `owner/name`; empty means no search. */
  search: string;
}

/** An integration as exposed to its owner: `uuid` and `label` only. */
export interface IntegrationSummary {
  uuid: string;
  label: string;
}

/** A current source: an integration, or the user's handle. */
export type SourceRef =
  | { kind: 'integration'; integration: IntegrationSummary }
  | { kind: 'handle'; handle: string };

/** One listing row. */
export interface ListedRepository {
  githubId: number;
  owner: string;
  name: string;
  /** `owner/name`. */
  fullName: string;
  private: boolean;
  status: RowStatus;
  addedAt: Date | null;
  lastSeenAt: Date;
  /** Every current source holding a row for the repo. */
  sources: SourceRef[];
  /** The access link; `null` when empty or dangling, and for not-added rows. */
  accessIntegration: IntegrationSummary | null;
}

/** The listing's result; `total` / `totalPages` count the filtered set. */
export interface ListResult {
  repositories: ListedRepository[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

/** A source's status as reported (`pending`: no status row, or a fixed integration). */
export type ReportedSourceStatus =
  | 'ok'
  | 'error'
  | 'invalid_credentials'
  | 'rate_limited'
  | 'page_cap_reached'
  | 'not_found'
  | 'pending';

/** One current source of the sync state. */
export type SourceState = SourceRef & {
  status: ReportedSourceStatus;
  /** `null` when `pending`. */
  syncedAt: Date | null;
  /** Only for `rate_limited`. */
  resetAt: Date | null;
};

/** The sync-state object (`docs/agents/backend/routes/repositories.md#sync-state`). */
export interface SyncStateResult {
  state: 'idle' | 'syncing';
  /** `null` when idle. */
  startedAt: Date | null;
  lastSyncedAt: Date | null;
  /** End of the Refresh cooldown; `null` when Refresh is available now. */
  refreshAvailableAt: Date | null;
  sources: SourceState[];
}

/** What a trigger (stale listing or Refresh) did. */
export type TriggerOutcome =
  | { kind: 'started' }
  | { kind: 'running'; startedAt: Date }
  | { kind: 'cooldown'; lastStartedAt: Date; refreshAvailableAt: Date }
  | { kind: 'fresh' }
  /** The session's user no longer exists (nothing created, nothing started). */
  | { kind: 'no_user' };

/** A repo ref (`docs/agents/backend/routes/repositories.md#repo-ref`), already validated by the caller. */
export type RepoRef = { githubId: number } | { fullName: string };

/**
 * What Add needs about one of the caller's rows. The listing shape is nested
 * under `repository` so the internal candidate inputs below are never
 * serialized with it: only `repository` may reach a response.
 */
export interface FoundRepository {
  /** The listing row (the only part a response may carry). */
  repository: ListedRepository;
  /** Internal ids of the integrations holding a source row for it (for the candidate walk). */
  holderIntegrationIds: number[];
  /** Whether the handle source holds it. */
  handleSeesRepo: boolean;
}

/** The repo metadata Add's re-check returned, stored with the mark. */
export interface RepositorySnapshot {
  owner: string;
  name: string;
  private: boolean;
}

/** How `markAdded` ended; `gone`: the row was pruned meanwhile. */
export type MarkAddedOutcome =
  | { kind: 'added'; repository: ListedRepository }
  | { kind: 'already_added'; repository: ListedRepository }
  | { kind: 'gone' };
