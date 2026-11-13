import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RepositoriesService } from './repositories.service.js';
import { refreshCooldown } from './repositories-http-errors.js';
import { RepositoryAddService } from './repository-add.service.js';
import { Clock } from '../core/clock.js';
import type {
  ListedRepository,
  ListInput,
  ListResult,
  RepoRef,
  SyncStateResult,
} from './types/repositories-api.types.js';

/** What the listing route answers, before shaping. */
export interface ListingResult {
  page: ListResult;
  sync: SyncStateResult;
}

/**
 * Maps the Repositories service outcomes to HTTP answers for the controller
 * (`docs/agents/specs/repos/api.md#routes`), so the controller only
 * validates, calls one method and shapes: `no_user` → `401`, the Refresh
 * cooldown → `429` with its delay, Add → `RepositoryAddService`.
 */
@Injectable()
export class RepositoriesHttpService {
  /**
   * @param {RepositoriesService} repositories - The data layer.
   * @param {RepositoryAddService} addService - Add's orchestration.
   * @param {Clock} clock - Turns the cooldown's end into a delay.
   */
  constructor(
    private readonly repositories: RepositoriesService,
    private readonly addService: RepositoryAddService,
    private readonly clock: Clock,
  ) {}

  /**
   * The listing: starts a sync when stale (outside the cooldown), then reads
   * the page and the sync state, so a sync it started reads `syncing`.
   * @param {number} userId - The session's user.
   * @param {ListInput} input - The validated listing input.
   * @returns {Promise<ListingResult>} The page and the sync state.
   */
  async listing(userId: number, input: ListInput): Promise<ListingResult> {
    if ((await this.repositories.triggerIfStale(userId)).kind === 'no_user') throw invalidSession();

    const [page, sync] = await Promise.all([this.repositories.list(userId, input), this.repositories.syncState(userId)]);

    return { page, sync };
  }

  /**
   * The sync state, after the handle reconciliation. Never starts a sync.
   * @param {number} userId - The session's user.
   * @returns {Promise<SyncStateResult>} The sync state.
   */
  async syncState(userId: number): Promise<SyncStateResult> {
    if ((await this.repositories.reconcileForRequest(userId)).kind === 'no_user') throw invalidSession();

    return this.repositories.syncState(userId);
  }

  /**
   * Refresh: starts a sync (or finds one running) and answers the sync state;
   * inside the cooldown answers `429 REPOSITORY_REFRESH_COOLDOWN`.
   * @param {number} userId - The session's user.
   * @returns {Promise<SyncStateResult>} The sync state.
   */
  async refresh(userId: number): Promise<SyncStateResult> {
    const outcome = await this.repositories.refresh(userId);

    if (outcome.kind === 'no_user') throw invalidSession();
    if (outcome.kind === 'cooldown') throw refreshCooldown(this.#secondsUntil(outcome.refreshAvailableAt));

    return this.repositories.syncState(userId);
  }

  /**
   * Add (`api.md#add`).
   * @param {number} userId - The session's user.
   * @param {RepoRef} ref - The validated repo ref.
   * @returns {Promise<ListedRepository>} The added row.
   */
  add(userId: number, ref: RepoRef): Promise<ListedRepository> {
    return this.addService.add(userId, ref);
  }

  /**
   * @param {Date} at - The cooldown's end.
   * @returns {number} Whole seconds until then, rounded up, at least 1.
   */
  #secondsUntil(at: Date): number {
    return Math.max(1, Math.ceil((at.getTime() - this.clock.now().getTime()) / 1000));
  }
}

/**
 * The `401` for a session whose user no longer exists.
 * @returns {UnauthorizedException} The exception.
 */
function invalidSession(): UnauthorizedException {
  return new UnauthorizedException('Invalid session');
}
