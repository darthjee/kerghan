import { ConflictException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ErrorCodes } from '../core/error-codes.js';

// One message for a missing, foreign or deleted project, so existence never leaks.
export const PROJECT_NOT_FOUND_MESSAGE = 'Project not found';
// Same message as Add's repository `404` (`repositories-http-errors.ts`), so the bodies match
// byte for byte; Issues may not import Repositories' error helpers (eslint boundary).
export const REPOSITORY_NOT_FOUND_MESSAGE = 'Repository not found';
// One message for a missing issue or one that belongs to another project.
export const ISSUE_NOT_FOUND_MESSAGE = 'Issue not found';

/**
 * 404 `NOT_FOUND`: the single answer for a project that is missing, another user's or deleted,
 * so every body is byte-identical (`docs/agents/specs/issues/api/errors-and-validation.md`).
 * @returns {NotFoundException} The exception.
 */
export function projectNotFound(): NotFoundException {
  return new NotFoundException(PROJECT_NOT_FOUND_MESSAGE);
}

/**
 * 404 `NOT_FOUND`: the single answer for an issue that is missing or in another project.
 * @returns {NotFoundException} The exception.
 */
export function issueNotFound(): NotFoundException {
  return new NotFoundException(ISSUE_NOT_FOUND_MESSAGE);
}

/**
 * 404 `NOT_FOUND`: a repo ref not among the caller's rows, identical to Add's repository `404`.
 * @returns {NotFoundException} The exception.
 */
export function repositoryNotFound(): NotFoundException {
  return new NotFoundException(REPOSITORY_NOT_FOUND_MESSAGE);
}

/**
 * 409 `PROJECTS_LIMIT_REACHED`: the caller already has the maximum number of live projects.
 * @returns {ConflictException} The exception.
 */
export function projectsLimitReached(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.PROJECTS_LIMIT_REACHED,
    message: 'You reached the maximum number of projects',
  });
}

/**
 * 409 `PROJECT_NAME_TAKEN`: another live project of the caller has this name.
 * @returns {ConflictException} The exception.
 */
export function projectNameTaken(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.PROJECT_NAME_TAKEN,
    message: 'A project with this name already exists',
  });
}

/**
 * 409 `PROJECT_REPOSITORY_TAKEN`: the repository already has a project of the caller.
 * @param {string} projectUuid - The public id of the existing project, exposed as `meta.projectId`.
 * @returns {ConflictException} The exception.
 */
export function projectRepositoryTaken(projectUuid: string): ConflictException {
  return new ConflictException({
    code: ErrorCodes.PROJECT_REPOSITORY_TAKEN,
    message: 'This repository already has a project',
    meta: { projectId: projectUuid },
  });
}

/**
 * 409 `PROJECT_REPOSITORY_NOT_ADDED`: the caller's repository row exists but is not added.
 * @returns {ConflictException} The exception.
 */
export function projectRepositoryNotAdded(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.PROJECT_REPOSITORY_NOT_ADDED,
    message: 'Add this repository first',
  });
}

/**
 * 409 `PROJECT_HAS_LINKS`: a repository change or detach while the project still has links.
 * @param {number} linkCount - The number of links, exposed as `meta.linkCount`.
 * @returns {ConflictException} The exception.
 */
export function projectHasLinks(linkCount: number): ConflictException {
  return new ConflictException({
    code: ErrorCodes.PROJECT_HAS_LINKS,
    message: "Unlink the project's issues before changing its repository",
    meta: { linkCount },
  });
}

/**
 * 409 `ISSUES_LIMIT_REACHED`: the project already holds the maximum number of issues.
 * @returns {ConflictException} The exception.
 */
export function issuesLimitReached(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.ISSUES_LIMIT_REACHED,
    message: 'This project reached the maximum number of issues',
  });
}

/**
 * 429 `ISSUE_EDIT_RATE_LIMITED`, with `Retry-After` and `error.retryAfterSeconds`.
 * @param {number} retryAfterSeconds - Seconds until the user's edit window resets.
 * @returns {HttpException} The exception.
 */
export function issueEditRateLimited(retryAfterSeconds: number): HttpException {
  return new HttpException(
    {
      code: ErrorCodes.ISSUE_EDIT_RATE_LIMITED,
      message: 'Too many edits; try again later',
      retryAfterSeconds,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

/**
 * 409 `ISSUE_LINKED`: a delete of an issue that still has a GitHub link.
 * @returns {ConflictException} The exception.
 */
export function issueLinked(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.ISSUE_LINKED,
    message: 'Unlink this issue before deleting it',
  });
}
