import { Injectable } from '@nestjs/common';
import { AddStore } from './add-store.js';
import { HandleReconciler, type RequestReconciliation } from './handle-reconciler.js';
import { type ListingRow, type ListingScope, RepositoriesListingQuery } from './repositories-listing.query.js';
import { HANDLE_SOURCE_KEY, parseSourceKey } from './source-key.js';
import { SyncLauncher } from './sync-launcher.js';
import { SyncRunner } from './sync-runner.js';
import { SyncStateReader } from './sync-state-reader.js';
import { type ClaimMode, SyncStateStore } from './sync-state.store.js';
import { IntegrationsGithubService } from '../integrations/integrations-github.public.js';
import type {
  FoundRepository,
  ListInput,
  ListResult,
  MarkAddedOutcome,
  RepoRef,
  RepositorySnapshot,
  SyncStateResult,
  TriggerOutcome,
} from './types/repositories-api.types.js';

/**
 * The Repositories module's only surface for the controller (#464): typed
 * inputs and outputs, no HTTP types. Every method takes `userId` from the
 * caller's session and scopes every query by it
 * (`docs/agents/specs/repos/model.md#ownership`). Nothing here calls GitHub:
 * the integrations are read through `listIntegrations` /
 * `listUsableIntegrations`, which read the database.
 */
@Injectable()
export class RepositoriesService {
  /**
   * @param {RepositoriesListingQuery} listing - The listing SQL.
   * @param {SyncStateReader} stateReader - The sync-state derivation.
   * @param {SyncStateStore} store - The lock (claim, lease-aware read).
   * @param {HandleReconciler} reconciler - The entry-point handle reconciliation.
   * @param {AddStore} addStore - Add's lookup and conditional write.
   * @param {SyncLauncher} launcher - Starts a claimed run detached.
   * @param {SyncRunner} runner - Builds the run's task.
   * @param {IntegrationsGithubService} github - Lists the user's integrations (DB reads only).
   */
  constructor(
    private readonly listing: RepositoriesListingQuery,
    private readonly stateReader: SyncStateReader,
    private readonly store: SyncStateStore,
    private readonly reconciler: HandleReconciler,
    private readonly addStore: AddStore,
    private readonly launcher: SyncLauncher,
    private readonly runner: SyncRunner,
    private readonly github: IntegrationsGithubService,
  ) {}

  /**
   * One page of the user's repositories (`api.md#listing`), filtered and searched before pagination.
   * @param {number} userId - The session's user.
   * @param {ListInput} input - The validated page, filter and search.
   * @returns {Promise<ListResult>} The rows and the filtered totals.
   */
  async list(userId: number, input: ListInput): Promise<ListResult> {
    const { rows, total } = await this.listing.page(userId, input, await this.#scope(userId));

    return { repositories: rows, page: input.page, perPage: input.perPage, total, totalPages: Math.ceil(total / input.perPage) };
  }

  /**
   * The sync-state object (`api.md#sync-state`). Never starts a sync.
   * @param {number} userId - The session's user.
   * @returns {Promise<SyncStateResult>} The object.
   */
  async syncState(userId: number): Promise<SyncStateResult> {
    const [view, integrations, usable] = await Promise.all([
      this.store.readState(userId),
      this.github.listIntegrations(userId),
      this.github.listUsableIntegrations(userId),
    ]);

    return this.stateReader.read(userId, view, { integrations, handle: view.handle }, usable);
  }

  /**
   * The listing's stale-sync trigger: starts a sync only when the last one is
   * stale and outside the Refresh cooldown.
   * @param {number} userId - The session's user.
   * @returns {Promise<TriggerOutcome>} What happened.
   */
  triggerIfStale(userId: number): Promise<TriggerOutcome> {
    return this.#trigger(userId, 'stale');
  }

  /**
   * Refresh: starts a sync unless one is running or the cooldown is on.
   * @param {number} userId - The session's user.
   * @returns {Promise<TriggerOutcome>} What happened.
   */
  refresh(userId: number): Promise<TriggerOutcome> {
    return this.#trigger(userId, 'refresh');
  }

  /**
   * The entry-point reconciliation for routes that start no sync (sync
   * state, Add): creates the sync-state row for an existing user and
   * reconciles the handle.
   * @param {number} userId - The session's user.
   * @returns {Promise<RequestReconciliation>} The current handle, or `no_user`.
   */
  reconcileForRequest(userId: number): Promise<RequestReconciliation> {
    return this.reconciler.forRequest(userId);
  }

  /**
   * Resolves a repo ref among the user's own rows (`api.md#repo-ref`).
   * @param {number} userId - The session's user.
   * @param {RepoRef} ref - The validated ref.
   * @returns {Promise<FoundRepository | null>} What Add needs, or `null` (#464 answers `404`).
   */
  async findByRef(userId: number, ref: RepoRef): Promise<FoundRepository | null> {
    const resolved = await this.addStore.resolve(userId, ref);
    const row = resolved === null ? null : await this.listing.one(userId, resolved, await this.#scope(userId));

    return row === null ? null : found(row);
  }

  /**
   * Add's conditional write (`api.md#add`): marks a not-added row of the
   * user as added with its access link.
   * @param {number} userId - The session's user.
   * @param {RepoRef} ref - The repo (as resolved by `findByRef`; a `githubId` ref is exact).
   * @param {number | null} integrationId - The access link, or `null`.
   * @param {RepositorySnapshot} [snapshot] - The re-check's metadata, stored with the mark.
   * @returns {Promise<MarkAddedOutcome>} `added`, `already_added` (a concurrent Add won) or `gone` (pruned).
   */
  async markAdded(userId: number, ref: RepoRef, integrationId: number | null, snapshot?: RepositorySnapshot): Promise<MarkAddedOutcome> {
    const resolved = await this.addStore.resolve(userId, ref);

    if (resolved === null) return { kind: 'gone' };

    const kind = await this.addStore.mark(userId, resolved, integrationId, snapshot);
    const row = kind === 'gone' ? null : await this.listing.one(userId, resolved, await this.#scope(userId));

    return row === null || kind === 'gone' ? { kind: 'gone' } : { kind, repository: row.repository };
  }

  /**
   * Reconciles, claims and, on `started`, launches the run detached.
   * @param {number} userId - The session's user.
   * @param {ClaimMode} mode - The trigger.
   * @returns {Promise<TriggerOutcome>} What happened.
   */
  async #trigger(userId: number, mode: ClaimMode): Promise<TriggerOutcome> {
    // `forRequest` creates the sync-state row (under the user-exists lock) when missing.
    if ((await this.reconciler.forRequest(userId)).kind === 'no_user') return { kind: 'no_user' };

    const outcome = await this.store.claim(userId, mode);

    switch (outcome.kind) {
      case 'started':
        this.launcher.launch(this.runner.task(userId, outcome.runId));
        return { kind: 'started' };
      case 'cooldown':
        return { ...outcome, refreshAvailableAt: this.stateReader.cooldownEnd(outcome.lastStartedAt) };
      case 'missing':
        return { kind: 'no_user' };
      default:
        return outcome;
    }
  }

  /**
   * @param {number} userId - The user.
   * @returns {Promise<ListingScope>} The current sources.
   */
  async #scope(userId: number): Promise<ListingScope> {
    const [integrations, view] = await Promise.all([this.github.listIntegrations(userId), this.store.readState(userId)]);

    return { integrations, handle: view.handle };
  }
}

/**
 * @param {ListingRow} row - A listed row.
 * @returns {FoundRepository} The row plus Add's candidate inputs.
 */
function found(row: ListingRow): FoundRepository {
  const holderIntegrationIds = row.sourceKeys.flatMap((key) => {
    const parsed = parseSourceKey(key);

    return parsed?.kind === 'integration' ? [parsed.integrationId] : [];
  });

  return { ...row.repository, holderIntegrationIds, handleSeesRepo: row.sourceKeys.includes(HANDLE_SOURCE_KEY) };
}
