import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ListRepositoriesDto, toListInput } from './dto/list-repositories.dto.js';
import { RepoRefDto, toRepoRef } from './dto/repo-ref.dto.js';
import { RepositoriesHttpService } from './repositories-http.service.js';
import {
  type ListingResponse,
  listingResponse,
  repositoryResponse,
  type RepositoryResponse,
  syncStateResponse,
  type SyncStateResponse,
} from './repositories-response.js';
import type { AccessTokenPayload } from '../core/access-token-payload.js';
import { CacheClass } from '../core/cache-class.js';
import { CachePolicy } from '../core/cache-policy.decorator.js';
import { CurrentUser } from '../core/current-user.decorator.js';

/**
 * Repositories routes (`docs/agents/specs/repos/api.md`) — thin: each
 * validates through its DTO, calls one `RepositoriesHttpService` method and
 * shapes the answer. Every route is `POST`, behind the global `JwtGuard` and
 * `OriginGuard` (no `@Public()`, no `@AdminOnly()`), scoped to the caller
 * from `@CurrentUser()`, cache class `user-scoped`, and never warmed by Navi.
 * Paths are declared in full, like the Integrations routes.
 */
@Controller()
@CachePolicy(CacheClass.UserScoped)
export class RepositoriesController {
  /**
   * @param {RepositoriesHttpService} http - Maps the module's outcomes to HTTP answers.
   */
  constructor(private readonly http: RepositoriesHttpService) {}

  /**
   * `POST /repositories/mine.json`. One page of the caller's repositories, with the sync state.
   * @param {ListRepositoriesDto} dto - Page, perPage, filter and search.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<ListingResponse>} `{ repositories, pagination, sync }`.
   */
  @Post('repositories/mine.json')
  @HttpCode(HttpStatus.OK)
  async mine(@Body() dto: ListRepositoriesDto, @CurrentUser() user: AccessTokenPayload): Promise<ListingResponse> {
    const { page, sync } = await this.http.listing(user.sub, toListInput(dto));

    return listingResponse(page, sync);
  }

  /**
   * `POST /repositories/sync/state.json`. The caller's sync state; never starts a sync.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<SyncStateResponse>} The sync-state object.
   */
  @Post('repositories/sync/state.json')
  @HttpCode(HttpStatus.OK)
  async syncState(@CurrentUser() user: AccessTokenPayload): Promise<SyncStateResponse> {
    return syncStateResponse(await this.http.syncState(user.sub));
  }

  /**
   * `POST /repositories/sync.json`. Refresh (202), or `429` inside the cooldown.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<SyncStateResponse>} The sync-state object.
   */
  @Post('repositories/sync.json')
  @HttpCode(HttpStatus.ACCEPTED)
  async refresh(@CurrentUser() user: AccessTokenPayload): Promise<SyncStateResponse> {
    return syncStateResponse(await this.http.refresh(user.sub));
  }

  /**
   * `POST /repositories/add.json`. Marks one of the caller's repositories as added.
   * @param {RepoRefDto} dto - The repo ref.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<RepositoryResponse>} The added row.
   */
  @Post('repositories/add.json')
  @HttpCode(HttpStatus.OK)
  async add(@Body() dto: RepoRefDto, @CurrentUser() user: AccessTokenPayload): Promise<RepositoryResponse> {
    return repositoryResponse(await this.http.add(user.sub, toRepoRef(dto)));
  }
}
