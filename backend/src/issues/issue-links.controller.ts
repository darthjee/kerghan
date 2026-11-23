import { Body, Controller, HttpCode, HttpStatus, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { AccessTokenPayload } from '../core/access-token-payload.js';
import { CacheClass } from '../core/cache-class.js';
import { CachePolicy } from '../core/cache-policy.decorator.js';
import { CurrentUser } from '../core/current-user.decorator.js';
import { uuidParamPipe } from '../core/uuid-param.pipe.js';
import { AttachIssueDto, toAttachIssueInput } from './dto/attach-issue.dto.js';
import { ImportIssueDto, toImportIssueInput } from './dto/import-issue.dto.js';
import { toUnlinkIssueInput, UnlinkIssueDto } from './dto/unlink-issue.dto.js';
import { IssueLinksService } from './issue-links.service.js';
import type { IssueResponse } from './issue-response.js';
import { IssueSyncTriggersService } from './issue-sync-triggers.service.js';
import type {
  RefreshIssueResponse,
  RefreshProjectResponse,
  RetrySyncResponse,
  UnlinkIssueResponse,
} from './types/issues-api.types.js';

/**
 * The GitHub link routes (`docs/agents/backend/routes/issues/github-link.md`) — thin: each validates
 * through its DTO, makes one `IssueLinksService` call and answers with its result. Every route is
 * `POST`, behind the global `JwtGuard` and `OriginGuard`, scoped to the caller from
 * `@CurrentUser()`, cache class `user-scoped`, and never warmed by Navi. Both path ids must be
 * uuids. Kept apart from `IssuesController`, which has no GitHub dependency.
 */
@Controller()
@CachePolicy(CacheClass.UserScoped)
export class IssueLinksController {
  /**
   * @param {IssueLinksService} links - The GitHub link business logic.
   * @param {IssueSyncTriggersService} triggers - The manual sync triggers (T2 to T4).
   */
  constructor(
    private readonly links: IssueLinksService,
    private readonly triggers: IssueSyncTriggersService,
  ) {}

  /**
   * `POST /projects/:projectId/issues/import.json`. Imports a GitHub issue as a new, linked issue.
   * @param {string} projectId - The project's public id.
   * @param {ImportIssueDto} dto - The GitHub issue number.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<IssueResponse>} The new issue (`201`).
   */
  @Post('projects/:projectId/issues/import.json')
  @HttpCode(HttpStatus.CREATED)
  import(
    @Param('projectId', uuidParamPipe()) projectId: string,
    @Body() dto: ImportIssueDto,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<IssueResponse> {
    return this.links.import(user.sub, projectId, toImportIssueInput(dto));
  }

  /**
   * `POST /projects/:projectId/issues/:issueId/attach.json`. Attaches a GitHub issue to an issue.
   * @param {string} projectId - The project's public id.
   * @param {string} issueId - The issue's public id.
   * @param {AttachIssueDto} dto - The GitHub issue number and optional confirmation.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<IssueResponse>} The issue (`200`).
   */
  @Post('projects/:projectId/issues/:issueId/attach.json')
  @HttpCode(HttpStatus.OK)
  attach(
    @Param('projectId', uuidParamPipe()) projectId: string,
    @Param('issueId', uuidParamPipe()) issueId: string,
    @Body() dto: AttachIssueDto,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<IssueResponse> {
    return this.links.attach(user.sub, projectId, issueId, toAttachIssueInput(dto));
  }

  /**
   * `POST /projects/:projectId/issues/:issueId/unlink.json`. Removes the issue's GitHub link.
   * @param {string} projectId - The project's public id.
   * @param {string} issueId - The issue's public id.
   * @param {UnlinkIssueDto} dto - Whether unsent changes may be dropped.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<UnlinkIssueResponse>} `{ issue, droppedUnsentChanges }`.
   */
  @Post('projects/:projectId/issues/:issueId/unlink.json')
  @HttpCode(HttpStatus.OK)
  unlink(
    @Param('projectId', uuidParamPipe()) projectId: string,
    @Param('issueId', uuidParamPipe()) issueId: string,
    @Body() dto: UnlinkIssueDto,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<UnlinkIssueResponse> {
    return this.links.unlink(user.sub, projectId, issueId, toUnlinkIssueInput(dto));
  }

  /**
   * `POST /projects/:projectId/issues/:issueId/refresh.json` (T2). Enqueues one reconcile of the
   * issue's link, or skips a link that is already fresh.
   * @param {string} projectId - The project's public id.
   * @param {string} issueId - The issue's public id.
   * @param {AccessTokenPayload} user - The caller.
   * @param {Response} response - Carries the status (`202` enqueued, `200` already fresh).
   * @returns {Promise<RefreshIssueResponse>} `{ issue, alreadyFresh }`.
   */
  @Post('projects/:projectId/issues/:issueId/refresh.json')
  async refresh(
    @Param('projectId', uuidParamPipe()) projectId: string,
    @Param('issueId', uuidParamPipe()) issueId: string,
    @CurrentUser() user: AccessTokenPayload,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshIssueResponse> {
    const { status, body } = await this.triggers.refreshIssue(user.sub, projectId, issueId);

    response.status(status);

    return body;
  }

  /**
   * `POST /projects/:projectId/refresh.json` (T3). Enqueues one reconcile per non-`gone` link of the project.
   * @param {string} projectId - The project's public id.
   * @param {AccessTokenPayload} user - The caller.
   * @param {Response} response - Carries the status (`202`).
   * @returns {Promise<RefreshProjectResponse>} `{ enqueued, skippedFresh }`.
   */
  @Post('projects/:projectId/refresh.json')
  async refreshProject(
    @Param('projectId', uuidParamPipe()) projectId: string,
    @CurrentUser() user: AccessTokenPayload,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshProjectResponse> {
    const { status, body } = await this.triggers.refreshProject(user.sub, projectId);

    response.status(status);

    return body;
  }

  /**
   * `POST /projects/:projectId/issues/:issueId/retry-sync.json` (T4). Resets a `sync_failed` link
   * and enqueues it; a `linked` link is a no-op.
   * @param {string} projectId - The project's public id.
   * @param {string} issueId - The issue's public id.
   * @param {AccessTokenPayload} user - The caller.
   * @param {Response} response - Carries the status (`202` reset and enqueued, `200` no-op).
   * @returns {Promise<RetrySyncResponse>} `{ issue }`.
   */
  @Post('projects/:projectId/issues/:issueId/retry-sync.json')
  async retrySync(
    @Param('projectId', uuidParamPipe()) projectId: string,
    @Param('issueId', uuidParamPipe()) issueId: string,
    @CurrentUser() user: AccessTokenPayload,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RetrySyncResponse> {
    const { status, body } = await this.triggers.retrySync(user.sub, projectId, issueId);

    response.status(status);

    return body;
  }
}
