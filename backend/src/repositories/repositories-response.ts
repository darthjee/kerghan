import type {
  IntegrationSummary,
  ListedRepository,
  ListResult,
  SourceRef,
  SourceState,
  SyncStateResult,
} from './types/repositories-api.types.js';

/**
 * The wire shapes of the Repositories API (`docs/agents/backend/routes/repositories.md`).
 * These pure functions are the only path from the typed service results to a
 * response: every field is copied explicitly (never spread), so no internal
 * field (the repository `id`, `user_id`, an `integrations.id`) can leak.
 * Dates become ISO strings, or `null`.
 */

/** An integration as exposed: `uuid` and `label` only. */
export interface IntegrationSummaryResponse {
  uuid: string;
  label: string;
}

/** A source entry of a row. */
export type SourceRefResponse =
  | { kind: 'integration'; integration: IntegrationSummaryResponse }
  | { kind: 'handle'; handle: string };

/** One listing row. */
export interface RepositoryResponse {
  githubId: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  status: string;
  addedAt: string | null;
  lastSeenAt: string;
  sources: SourceRefResponse[];
  accessIntegration: IntegrationSummaryResponse | null;
}

/** A source entry of the sync state. */
export type SourceStateResponse = SourceRefResponse & {
  status: string;
  syncedAt: string | null;
  resetAt: string | null;
};

/** The sync-state object. */
export interface SyncStateResponse {
  state: 'idle' | 'syncing';
  startedAt: string | null;
  lastSyncedAt: string | null;
  refreshAvailableAt: string | null;
  sources: SourceStateResponse[];
}

/** The listing's body. */
export interface ListingResponse {
  repositories: RepositoryResponse[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
  sync: SyncStateResponse;
}

/**
 * @param {Date | null} date - A date, or `null`.
 * @returns {string | null} Its ISO string, or `null`.
 */
function iso(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

/**
 * @param {IntegrationSummary} integration - An integration summary.
 * @returns {IntegrationSummaryResponse} `uuid` and `label` only.
 */
function integrationSummary(integration: IntegrationSummary): IntegrationSummaryResponse {
  return { uuid: integration.uuid, label: integration.label };
}

/**
 * @param {SourceRef} source - A current source.
 * @returns {SourceRefResponse} Its wire shape.
 */
function sourceRef(source: SourceRef): SourceRefResponse {
  return source.kind === 'integration'
    ? { kind: 'integration', integration: integrationSummary(source.integration) }
    : { kind: 'handle', handle: source.handle };
}

/**
 * @param {SourceState} source - A source of the sync state.
 * @returns {SourceStateResponse} Its wire shape.
 */
function sourceState(source: SourceState): SourceStateResponse {
  return { ...sourceRef(source), status: source.status, syncedAt: iso(source.syncedAt), resetAt: iso(source.resetAt) };
}

/**
 * Serializes one listing row.
 * @param {ListedRepository} row - The row.
 * @returns {RepositoryResponse} The wire row.
 */
export function repositoryResponse(row: ListedRepository): RepositoryResponse {
  return {
    githubId: row.githubId,
    owner: row.owner,
    name: row.name,
    fullName: row.fullName,
    private: row.private,
    status: row.status,
    addedAt: iso(row.addedAt),
    lastSeenAt: row.lastSeenAt.toISOString(),
    sources: row.sources.map(sourceRef),
    accessIntegration: row.accessIntegration === null ? null : integrationSummary(row.accessIntegration),
  };
}

/**
 * Serializes the sync-state object.
 * @param {SyncStateResult} state - The sync state.
 * @returns {SyncStateResponse} The wire object.
 */
export function syncStateResponse(state: SyncStateResult): SyncStateResponse {
  return {
    state: state.state,
    startedAt: iso(state.startedAt),
    lastSyncedAt: iso(state.lastSyncedAt),
    refreshAvailableAt: iso(state.refreshAvailableAt),
    sources: state.sources.map(sourceState),
  };
}

/**
 * Serializes the listing.
 * @param {ListResult} result - The page.
 * @param {SyncStateResult} sync - The sync state.
 * @returns {ListingResponse} The wire body.
 */
export function listingResponse(result: ListResult, sync: SyncStateResult): ListingResponse {
  return {
    repositories: result.repositories.map(repositoryResponse),
    pagination: { page: result.page, perPage: result.perPage, total: result.total, totalPages: result.totalPages },
    sync: syncStateResponse(sync),
  };
}
