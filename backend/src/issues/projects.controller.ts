import { Body, Controller, HttpCode, HttpStatus, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { AccessTokenPayload } from '../core/access-token-payload.js';
import { CacheClass } from '../core/cache-class.js';
import { CachePolicy } from '../core/cache-policy.decorator.js';
import { CurrentUser } from '../core/current-user.decorator.js';
import { uuidParamPipe } from '../core/uuid-param.pipe.js';
import { CreateProjectDto, toCreateProjectInput } from './dto/create-project.dto.js';
import { EditProjectDto, toEditProjectInput } from './dto/edit-project.dto.js';
import { ListProjectsDto, toListProjectsInput } from './dto/list-projects.dto.js';
import { ProjectFromRepositoryDto, toProjectFromRepositoryInput } from './dto/project-from-repository.dto.js';
import { ProjectRepositoryDto, toProjectRepositoryInput } from './dto/project-repository.dto.js';
import type { ProjectDeleteResponse, ProjectListingResponse, ProjectResponse } from './project-response.js';
import { ProjectsService } from './projects.service.js';

/**
 * Projects routes (`docs/agents/specs/issues/api/projects.md`) — thin: each validates through its
 * DTO, makes one `ProjectsService` call and answers with its result. Every route is `POST`,
 * behind the global `JwtGuard` and `OriginGuard` (no `@Public()`, no `@AdminOnly()`), scoped to
 * the caller from `@CurrentUser()`, cache class `user-scoped`, and never warmed by Navi. Paths are
 * declared in full, like the Repositories routes; the `:projectId` path id must be a uuid.
 */
@Controller()
@CachePolicy(CacheClass.UserScoped)
export class ProjectsController {
  /**
   * @param {ProjectsService} projects - The Projects business logic.
   */
  constructor(private readonly projects: ProjectsService) {}

  /**
   * `POST /projects/mine.json`. One page of the caller's live projects, sorted by name.
   * @param {ListProjectsDto} dto - Page, perPage and search.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<ProjectListingResponse>} `{ projects, pagination }`.
   */
  @Post('projects/mine.json')
  @HttpCode(HttpStatus.OK)
  mine(@Body() dto: ListProjectsDto, @CurrentUser() user: AccessTokenPayload): Promise<ProjectListingResponse> {
    return this.projects.list(user.sub, toListProjectsInput(dto));
  }

  /**
   * `POST /projects/create.json`. Explicit creation: a name, an optional description and an
   * optional repository (none makes a non-code project).
   * @param {CreateProjectDto} dto - The project's fields.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<ProjectResponse>} The new project (`201`).
   */
  @Post('projects/create.json')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProjectDto, @CurrentUser() user: AccessTokenPayload): Promise<ProjectResponse> {
    return (await this.projects.create(user.sub, toCreateProjectInput(dto), 'explicit')).project;
  }

  /**
   * `POST /projects/from-repository.json`. The shortcut from an added repository: `201` and a new
   * project, or `200` and the repository's existing one.
   * @param {ProjectFromRepositoryDto} dto - The repository and the optional name and description.
   * @param {AccessTokenPayload} user - The caller.
   * @param {Response} response - Only to set the status from the service result.
   * @returns {Promise<ProjectResponse>} The project.
   */
  @Post('projects/from-repository.json')
  async fromRepository(
    @Body() dto: ProjectFromRepositoryDto,
    @CurrentUser() user: AccessTokenPayload,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ProjectResponse> {
    const { status, project } = await this.projects.create(user.sub, toProjectFromRepositoryInput(dto), 'shortcut');

    response.status(status);

    return project;
  }

  /**
   * `POST /projects/:projectId/show.json`. One of the caller's live projects.
   * @param {string} projectId - The project's public id.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<ProjectResponse>} The project.
   */
  @Post('projects/:projectId/show.json')
  @HttpCode(HttpStatus.OK)
  show(@Param('projectId', uuidParamPipe()) projectId: string, @CurrentUser() user: AccessTokenPayload): Promise<ProjectResponse> {
    return this.projects.show(user.sub, projectId);
  }

  /**
   * `POST /projects/:projectId/edit.json`. Edits the name and/or description.
   * @param {string} projectId - The project's public id.
   * @param {EditProjectDto} dto - The fields to change.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<ProjectResponse>} The project.
   */
  @Post('projects/:projectId/edit.json')
  @HttpCode(HttpStatus.OK)
  edit(
    @Param('projectId', uuidParamPipe()) projectId: string,
    @Body() dto: EditProjectDto,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<ProjectResponse> {
    return this.projects.edit(user.sub, projectId, toEditProjectInput(dto));
  }

  /**
   * `POST /projects/:projectId/repository.json`. Connects, changes or detaches (`null`) the
   * project's repository.
   * @param {string} projectId - The project's public id.
   * @param {ProjectRepositoryDto} dto - The repository ref, or `null`.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<ProjectResponse>} The project.
   */
  @Post('projects/:projectId/repository.json')
  @HttpCode(HttpStatus.OK)
  repository(
    @Param('projectId', uuidParamPipe()) projectId: string,
    @Body() dto: ProjectRepositoryDto,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<ProjectResponse> {
    return this.projects.setRepository(user.sub, projectId, toProjectRepositoryInput(dto));
  }

  /**
   * `POST /projects/:projectId/delete.json`. Deletes the project and its issues.
   * @param {string} projectId - The project's public id.
   * @param {AccessTokenPayload} user - The caller.
   * @returns {Promise<ProjectDeleteResponse>} `{ unsentIssueCount }`.
   */
  @Post('projects/:projectId/delete.json')
  @HttpCode(HttpStatus.OK)
  delete(@Param('projectId', uuidParamPipe()) projectId: string, @CurrentUser() user: AccessTokenPayload): Promise<ProjectDeleteResponse> {
    return this.projects.delete(user.sub, projectId);
  }
}
