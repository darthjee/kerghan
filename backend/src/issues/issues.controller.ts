import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import type { AccessTokenPayload } from '../core/access-token-payload.js';
import { CacheClass } from '../core/cache-class.js';
import { CachePolicy } from '../core/cache-policy.decorator.js';
import { CurrentUser } from '../core/current-user.decorator.js';
import { uuidParamPipe } from '../core/uuid-param.pipe.js';
import { BulkIssueStateDto, toBulkIssueStateInput } from './dto/bulk-issue-state.dto.js';
import { CreateIssueDto, toCreateIssueInput } from './dto/create-issue.dto.js';
import { EditIssueDto, toEditIssueInput } from './dto/edit-issue.dto.js';
import { ListIssuesDto, toListIssuesInput } from './dto/list-issues.dto.js';
import type { IssueDeleteResponse, IssueListingResponse, IssueResponse } from './issue-response.js';
import { IssuesService } from './issues.service.js';
import type { BulkIssueStateResponse } from './types/issues-api.types.js';

/**
 * Issues routes (`docs/agents/specs/issues/api/issues.md`) — thin: each validates through its
 * DTO, makes one `IssuesService` call and answers with its result. Every route is `POST`, behind
 * the global `JwtGuard` and `OriginGuard` (no `@Public()`, no `@AdminOnly()`), scoped to the
 * caller from `@CurrentUser()`, cache class `user-scoped`, and never warmed by Navi. Paths are
 * declared in full; both path ids must be uuids.
 */
@Controller()
@CachePolicy(CacheClass.UserScoped)
export class IssuesController {
  /**
   * @param {IssuesService} issues - The Issues business logic.
   */
  constructor(private readonly issues: IssuesService) {}

  /**
   * `POST /projects/:projectId/issues.json`. One page of the project's issues, without bodies.
   * @param {string} projectId - The project's public id.
   * @param {ListIssuesDto} dto - Page, perPage, state and search.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<IssueListingResponse>} `{ issues, pagination }`.
   */
  @Post('projects/:projectId/issues.json')
  @HttpCode(HttpStatus.OK)
  list(
    @Param('projectId', uuidParamPipe()) projectId: string,
    @Body() dto: ListIssuesDto,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<IssueListingResponse> {
    return this.issues.list(user.sub, projectId, toListIssuesInput(dto));
  }

  /**
   * `POST /projects/:projectId/issues/create.json`. Creates an unlinked issue.
   * @param {string} projectId - The project's public id.
   * @param {CreateIssueDto} dto - The issue's fields.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<IssueResponse>} The new issue (`201`).
   */
  @Post('projects/:projectId/issues/create.json')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('projectId', uuidParamPipe()) projectId: string,
    @Body() dto: CreateIssueDto,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<IssueResponse> {
    return this.issues.create(user.sub, projectId, toCreateIssueInput(dto));
  }

  /**
   * `POST /projects/:projectId/issues/:issueId/show.json`. One issue of the project.
   * @param {string} projectId - The project's public id.
   * @param {string} issueId - The issue's public id.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<IssueResponse>} The issue.
   */
  @Post('projects/:projectId/issues/:issueId/show.json')
  @HttpCode(HttpStatus.OK)
  show(
    @Param('projectId', uuidParamPipe()) projectId: string,
    @Param('issueId', uuidParamPipe()) issueId: string,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<IssueResponse> {
    return this.issues.show(user.sub, projectId, issueId);
  }

  /**
   * `POST /projects/:projectId/issues/:issueId/edit.json`. Edits title, body and/or state.
   * @param {string} projectId - The project's public id.
   * @param {string} issueId - The issue's public id.
   * @param {EditIssueDto} dto - The fields to change.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<IssueResponse>} The issue.
   */
  @Post('projects/:projectId/issues/:issueId/edit.json')
  @HttpCode(HttpStatus.OK)
  edit(
    @Param('projectId', uuidParamPipe()) projectId: string,
    @Param('issueId', uuidParamPipe()) issueId: string,
    @Body() dto: EditIssueDto,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<IssueResponse> {
    return this.issues.edit(user.sub, projectId, issueId, toEditIssueInput(dto));
  }

  /**
   * `POST /projects/:projectId/issues/bulk-state.json`. Closes or reopens many issues at once.
   * @param {string} projectId - The project's public id.
   * @param {BulkIssueStateDto} dto - The issue ids and the target state.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<BulkIssueStateResponse>} `{ state, changed, unchanged, notFound }`.
   */
  @Post('projects/:projectId/issues/bulk-state.json')
  @HttpCode(HttpStatus.OK)
  bulkState(
    @Param('projectId', uuidParamPipe()) projectId: string,
    @Body() dto: BulkIssueStateDto,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<BulkIssueStateResponse> {
    return this.issues.bulkState(user.sub, projectId, toBulkIssueStateInput(dto));
  }

  /**
   * `POST /projects/:projectId/issues/:issueId/delete.json`. Deletes an unlinked issue.
   * @param {string} projectId - The project's public id.
   * @param {string} issueId - The issue's public id.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<IssueDeleteResponse>} `{}`.
   */
  @Post('projects/:projectId/issues/:issueId/delete.json')
  @HttpCode(HttpStatus.OK)
  delete(
    @Param('projectId', uuidParamPipe()) projectId: string,
    @Param('issueId', uuidParamPipe()) issueId: string,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<IssueDeleteResponse> {
    return this.issues.delete(user.sub, projectId, issueId);
  }
}
